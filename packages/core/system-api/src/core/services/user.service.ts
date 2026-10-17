import { currentSystemRuntime } from '@/runtime'
import type { FastifyInstance } from "fastify";
import { UserRepository, type CreateUserInput, type UpdateUserInput } from "../repositories/user.repository.js";
import { UserMapper } from "../mappers/user.mapper.js";
import { CreateUserReq, UserListQuery, SysUserResp, UpdateUserReq } from "../schemas/user.js";
import { UserErrorCode } from "@yishan/core-api/business-codes/user";
import { BusinessError } from "@yishan/core-api/errors";
import { CACHE_CONFIG } from "../../config/index.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { PermissionService } from "./permission.service.js";
import { validateUserCreation, resolveCreatableDeptScope, type UserCreationSubject } from "./user-creation-policy.js";
import { mergeDraftFields, type DraftSubmission, type UserCreationParticipant } from "./user-creation.js";
import { currentDataScope } from "@/core/auth/data-scope";
import type { AppQueryDb, AppTx } from "@/db";

/**
 * 「这是不是一次明确的业务失败」。
 *
 * 业务码与 4xx 是「用户/数据本身不合法」——值得写进草稿的 `failureReason`。
 * 5xx 与非错误对象是基础设施故障或进程崩溃：草稿必须留在原状态等人重试，
 * 因为没人知道上一次到底发生了什么。
 */
function isBusinessFailure(error: unknown): boolean {
  if (error instanceof BusinessError) return true;
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

export class UserService {
  static findActiveUsersByDeptId(deptId: number) {
    return UserRepository.findActiveUsersByDeptId(deptId);
  }

  private static readonly USER_DETAIL_CACHE_KEY_PREFIX = 'user:detail:';

  private static getUserDetailCacheKey(userId: number): string {
    return `${currentSystemRuntime().config.cacheNamespace}:${this.USER_DETAIL_CACHE_KEY_PREFIX}${userId}`;
  }

  static async getUserList(query: UserListQuery) {
    const safePage = Math.max(1, query.page || 1);
    const safePageSize = Math.max(1, Math.min(100, query.pageSize || 10));

    // 转换时间字符串为 Date 对象
    const repositoryQuery = {
      ...query,
      page: safePage,
      pageSize: safePageSize,
      startTime: query.startTime ? new Date(query.startTime) : undefined,
      endTime: query.endTime ? new Date(query.endTime) : undefined,
    };

    const items = await UserRepository.list(repositoryQuery);
    const total = await UserRepository.count(repositoryQuery);

    const list = items.map(UserMapper.toListResp);

    return {
      list,
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /**
   * @param enforceScope 行级数据范围（sys_role.data_scope）。默认 true。
   *   `jwt-auth` 解析当前登录用户自己时必须传 false —— 否则一个「仅本人」
   *   档位的用户会把自己过滤掉，全站无法登录。
   */
  static async getUserById(id: number, fastify?: FastifyInstance, enforceScope = true): Promise<SysUserResp | null> {
    // 缓存里存的是全量详情，本身不带数据范围。若本次请求有行级限制，
    // 直接走 repository（它带 where），而不是先命中缓存再放行——
    // 否则「拿缓存里的任意 id」就绕过了 dataScope。
    const dataScope = await UserRepository.dataScopeCondition(enforceScope);
    const cacheable = dataScope === undefined;

    if (fastify?.redis && cacheable) {
      try {
        const cacheKey = this.getUserDetailCacheKey(id);
        const cached = await fastify.redis.get(cacheKey);
        if (cached) {
          const cachedUser = JSON.parse(cached);
          // 规范化 roleIds 和 deptIds，确保是数字数组
          return {
            ...cachedUser,
            roleIds: Array.isArray(cachedUser.roleIds)
              ? cachedUser.roleIds.map(id => Number(id)).filter(id => !isNaN(id))
              : [],
            deptIds: Array.isArray(cachedUser.deptIds)
              ? cachedUser.deptIds.map(id => Number(id)).filter(id => !isNaN(id))
              : [],
          };
        }
      } catch (error) {
        fastify.log.warn(`Redis缓存获取失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const user = await UserRepository.findByIdWithScope(id, dataScope);
    if (!user) return null;

    const resp = UserMapper.toDetailResp(user);

    if (fastify?.redis && cacheable) {
      try {
        const cacheKey = this.getUserDetailCacheKey(id);
        await fastify.redis.setex(cacheKey, CACHE_CONFIG.defaultTTLSeconds, JSON.stringify(resp));
      } catch (error) {
        fastify.log.warn(`创建用户后写入缓存失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return resp;
  }

  /**
   * 创建用户。
   *
   * 一条事务，两种入口（Task 5）：
   *
   *   - 普通创建：请求里没有 `draftSubmission`，行为与从前一致。
   *   - 草稿创建：带 `draftSubmission` 与一个精确版本号。事务内先通过**注入的**
   *     参与者认领草稿（锁会话 → 锁草稿），用**服务端持久化的草稿字段**创建用户，
   *     再在同一事务里写成功回执。三件事同生共死。
   *
   * 授权判定、唯一性、业务字段校验都在**事务内**、紧挨着真正的 INSERT 执行。
   * 判完之后再开事务，中间任何一次权限回收都能写出一个越权用户 —— 这正是
   * 「授权决定与创建不是原子的」这个漏洞。
   *
   * 缓存刷新与生命周期通知在**提交之后**做：它们失败时业务已经落地，
   * 再抛错只会把一次成功的创建报成失败，诱导用户或助手重试出第二个用户。
   */
  static async createUser(userReq: CreateUserReq, currentUserId: number, fastify?: FastifyInstance): Promise<SysUserResp> {
    const { draftSubmission, ...submitted } = userReq;
    // 有提交、无参与者 = 拒绝。绝不降级成普通创建。
    const participant = draftSubmission ? this.requireCreationParticipant() : undefined;

    this.validatePassword(userReq.password);

    // 操作者身份完全来自服务端：actorId 来自认证，tokenScope 来自本次 PAT。
    const subject: UserCreationSubject = {
      actorId: currentUserId,
      tokenScope: currentDataScope()?.tokenScope,
    };

    let resp: SysUserResp;
    // 只有**成功认领**过草稿的失败才记录 failed。claim 本身失败（版本不符、已过期、
    // 别人正在提交）时草稿根本没有被我们动过，写 failureReason 只会撒谎。
    let claimed = false;
    try {
      resp = await UserRepository.transaction(async (tx) => {
        const claim = participant
          ? await participant.claim(tx, currentUserId, draftSubmission!)
          : undefined;
        if (claim) claimed = true;

        // 重复提交：草稿早已完成过一次创建。回读既有结果，绝不再创建一次。
        if (claim?.kind === 'replay') {
          return await this.readCompletedCreation(subject, claim.userId, tx);
        }

        // 草稿路径以**服务端草稿**为准；普通路径就是请求本身。
        const fields = claim?.kind === 'create' ? mergeDraftFields(claim.fields, submitted) : submitted;

        await this.ensureUniqueFields(fields.username, fields.email, fields.phone, undefined, tx);

        // 统一的创建授权规则：角色组合的权限码与数据范围、部门关联都必须落在
        // 当前请求身份内。与 AI 草稿提交共用同一份实现，不存在「宽松版本」。
        await validateUserCreation(subject, fields, { db: tx });

        await currentSystemRuntime().validateUser({ operation: 'create', actorId: currentUserId, fields: { ...fields } });

        const input = await this.toCreateUserInput({ ...fields, password: userReq.password } as CreateUserReq, currentUserId);
        const createdUser = await UserRepository.create(input, tx);
        const created = UserMapper.toDetailResp(createdUser);

        // 回执与创建同事务：这里抛错，用户和草稿一起回滚。
        if (participant) await participant.complete(tx, currentUserId, draftSubmission!, created);
        return created;
      });
    } catch (error) {
      // 事务已经回滚。此刻草稿回到原版本、原状态，可以安全地按版本条件记 failed。
      await this.recordDraftFailure(participant, claimed ? draftSubmission : undefined, currentUserId, error);
      throw error;
    }

    // ---- 以下全部在提交之后：失败只记录，不再抛 ----------------------------
    if (fastify?.redis) {
      try {
        const cacheKey = this.getUserDetailCacheKey(resp.id);
        await fastify.redis.setex(cacheKey, CACHE_CONFIG.defaultTTLSeconds, JSON.stringify(resp));
      } catch (error) {
        fastify.log.warn(`创建用户后写入缓存失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Section 1 — RBAC：用户新建时若分配了角色，全局失效权限缓存以确保立即生效。
    UserService.invalidatePermissionCache(resp.roleIds);
    await currentSystemRuntime().notifyUser({ type: 'user.created', actorId: currentUserId, user: resp });

    return resp;
  }

  /**
   * 取注入的事务参与方。
   *
   * 缺席意味着这次部署没有安装 AI 模块，因此**没有**能兑现「同一草稿只创建一次」
   * 承诺的代码。此时放行等于对调用方撒谎：助手会以为重试是安全的。
   */
  private static requireCreationParticipant(): UserCreationParticipant {
    const participant = currentSystemRuntime().options.userCreationParticipant;
    if (!participant) {
      throw new BusinessError(
        UserErrorCode.USER_STATUS_ERROR,
        '草稿提交不可用：当前服务未安装草稿提供者，无法保证同一次草稿只创建一个用户',
      );
    }
    return participant;
  }

  /**
   * 重放：读取**已验证回执**指向的创建结果。
   *
   * 两道门缺一不可：
   *
   *   1. `claim` 已经在事务内校验了「这份草稿归当前用户、且它确实完成过一次创建」。
   *      因此 userId 不是调用方给的任意 ID —— 这条入口不提供按 id 查用户的能力。
   *   2. 创建权限**重新计算**。权限在两次点击之间被回收时，重放必须失败，
   *      否则「读既有结果」会变成绕过权限的读取通道。
   *
   * 不要求 `system:user:list`：重复点击同一个表单的人未必有列表权限，
   * 而用户能看到自己刚创建的结果是本流程的基本体验。
   * 结果已被删除时明确报「已完成」，绝不重新创建。
   */
  private static async readCompletedCreation(
    subject: UserCreationSubject,
    userId: number,
    tx: AppTx,
  ): Promise<SysUserResp> {
    const { creatable } = await resolveCreatableDeptScope(subject, { db: tx });
    if (!creatable) {
      throw new BusinessError(UserErrorCode.USER_CREATE_FORBIDDEN, '你没有新增用户的权限');
    }
    const user = await UserRepository.findById(userId, tx, false);
    if (!user) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, '该草稿已完成创建，对应用户已被删除');
    }
    return UserMapper.toDetailResp(user);
  }

  /**
   * 事务回滚之后记录草稿失败。
   *
   * 只对**明确的业务/校验失败**记录：基础设施故障（连接断开、进程崩溃）由数据库
   * 回滚恢复，草稿留在原状态仍可重试，把它标成 failed 反而声称「已知结果」——
   * 那正是设计 §11 禁止的凭内存猜测。
   */
  private static async recordDraftFailure(
    participant: UserCreationParticipant | undefined,
    submission: DraftSubmission | undefined,
    actorId: number,
    error: unknown,
  ): Promise<void> {
    if (!participant?.fail || !submission || !isBusinessFailure(error)) return;
    try {
      await participant.fail({
        actorId,
        submission,
        reason: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // 记录失败原因失败不影响原始错误：那才是用户真正要看到的东西。
    }
  }

  private static validatePassword(password: string): void {
    if (password.length < 6 || password.length > 50) {
      throw new BusinessError(UserErrorCode.PASSWORD_WEAK, "密码长度必须在6-50个字符之间");
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
      throw new BusinessError(UserErrorCode.PASSWORD_WEAK, "密码必须包含至少一个字母和一个数字");
    }
    const allowedChars = /^[a-zA-Z\d@$!%*?&]+$/;
    if (!allowedChars.test(password)) {
      throw new BusinessError(UserErrorCode.PASSWORD_WEAK, "密码只能包含字母、数字和特殊字符(@$!%*?&)");
    }
  }

  static async updateUser(
    id: number,
    userReq: UpdateUserReq,
    currentUserId: number,
    fastify?: FastifyInstance
  ): Promise<SysUserResp | null> {
    // 目标用户必须落在本次操作的数据范围内：范围外的用户在这里就表现为「不存在」，
    // 修改/删除因此无法绕过列表过滤。
    const existingUser = await UserRepository.findById(id);
    if (!existingUser) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
    }

    await this.ensureUniqueFields(userReq.username, userReq.email, userReq.phone, id);

    if (userReq.password !== undefined) {
      this.validatePassword(userReq.password);
    }

    await currentSystemRuntime().validateUser({ operation: 'update', userId: id, actorId: currentUserId, fields: { ...userReq } });
    const input = await this.toUpdateUserInput(userReq, currentUserId);
    const updatedUser = await UserRepository.updateInTransaction(id, input);
    const resp = UserMapper.toDetailResp(updatedUser);

    if (fastify?.redis) {
      try {
        const cacheKey = this.getUserDetailCacheKey(id);
        await fastify.redis.setex(cacheKey, CACHE_CONFIG.defaultTTLSeconds, JSON.stringify(resp));
      } catch (error) {
        fastify.log.warn(`更新用户后刷新缓存失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Section 1 — RBAC：roleIds 变更会影响该用户持有的权限集合，失效涉及的角色 ID 缓存。
    const roleIdsToInvalidate = Array.from(
      new Set([...(existingUser.roleIds ?? []), ...(updatedUser.roleIds ?? [])]),
    );
    UserService.invalidatePermissionCache(roleIdsToInvalidate);
    await currentSystemRuntime().notifyUser({ type: 'user.updated', actorId: currentUserId, user: resp });

    return resp;
  }

  /**
   * Change the password for the given user.
   * Validates the old password against the stored hash, validates strength of
   * the new password, then atomically writes the new hash and revokes all
   * active access/refresh tokens for that user (forces re-login).
   */
  static async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
    fastify?: FastifyInstance,
  ): Promise<void> {
    const passwordHash = await UserRepository.findPasswordHashById(userId);
    if (!passwordHash) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
    }

    const ok = await comparePassword(oldPassword, passwordHash);
    if (!ok) {
      throw new BusinessError(UserErrorCode.PASSWORD_ERROR, "旧密码错误");
    }

    // Strength check (also run by toUpdateUserInput via validatePassword,
    // but we do it here explicitly since changePassword bypasses updateUser).
    this.validatePassword(newPassword);

    const newPasswordHash = await hashPassword(newPassword);

    await UserRepository.changePasswordInTransaction(userId, newPasswordHash);

    await this.clearUserDetailCache(userId, fastify);
  }

  /**
   * @param id       待删除的用户
   * @param actorId  操作者。用于「不能删除当前登录用户」的保护；不传则跳过该条
   *                 （仅限内部维护调用，任何带身份的服务端调用都必须传）
   *
   * 「系统管理员不可删除」与「不能删除当前登录用户」两条保护住在这里而不是
   * route 层：任何绕过 HTTP 的调用方（AI 能力、脚本、未来的内部任务）都会
   * 绕过闭包里的判断，从而能删掉 id=1 或自己删自己。Route 层只负责传 actorId。
   */
  static async deleteUser(
    id: number,
    actorId?: number,
    fastify?: FastifyInstance
  ): Promise<{ id: number; deleted: boolean }> {
    if (id === 1) {
      throw new BusinessError(UserErrorCode.USER_STATUS_ERROR, "系统管理员不可删除");
    }
    if (actorId !== undefined && actorId === id) {
      throw new BusinessError(UserErrorCode.USER_STATUS_ERROR, "不能删除当前登录用户");
    }

    // 同 updateUser：删除目标也必须在本次操作的数据范围内。
    const existingUser = await UserRepository.findById(id);
    if (!existingUser) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
    }

    await UserRepository.deleteUserInTransaction(id);

    await this.clearUserDetailCache(id, fastify);
    return { id, deleted: true };
  }

  private static async ensureUniqueFields(
    username?: string,
    email?: string,
    phone?: string,
    excludeUserId?: number,
    // 创建路径必须传入事务句柄：在事务外查一次唯一性再插入，中间存在被别人抢注的
    // 窗口。更新路径不传，仍走默认句柄。
    db?: AppQueryDb,
  ): Promise<void> {
    if (username !== undefined) {
      const userId = await UserRepository.findIdByUsername(username, db);
      if (userId !== null && userId !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "用户名已存在");
      }
    }

    if (email !== undefined) {
      const userId = await UserRepository.findIdByEmail(email, db);
      if (userId !== null && userId !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "邮箱已存在");
      }
    }

    if (phone !== undefined) {
      const userId = await UserRepository.findIdByPhone(phone, db);
      if (userId !== null && userId !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "手机号已存在");
      }
    }
  }

  private static async toCreateUserInput(
    request: CreateUserReq,
    currentUserId: number,
  ): Promise<CreateUserInput> {
    return {
      username: request.username,
      email: request.email,
      phone: request.phone,
      realName: request.realName,
      nickname: request.nickname,
      avatar: request.avatar,
      gender: Number(request.gender ?? "0"),
      status: Number(request.status ?? "1"),
      birthDate: this.toNullableDate(request.birthDate),
      passwordHash: await hashPassword(request.password),
      creatorId: currentUserId,
      updaterId: currentUserId,
      deptIds: request.deptIds,
      roleIds: request.roleIds,
    };
  }

  private static async toUpdateUserInput(
    request: UpdateUserReq,
    currentUserId: number,
  ): Promise<UpdateUserInput> {
    return {
      username: request.username,
      email: request.email,
      phone: request.phone,
      realName: request.realName,
      nickname: request.nickname,
      avatar: request.avatar,
      gender: request.gender === undefined ? undefined : Number(request.gender),
      status: request.status === undefined ? undefined : Number(request.status),
      birthDate: this.toNullableDate(request.birthDate),
      passwordHash: request.password === undefined ? undefined : await hashPassword(request.password),
      updaterId: currentUserId,
      deptIds: request.deptIds,
      roleIds: request.roleIds,
    };
  }

  private static toNullableDate(value: string | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    return value === "" ? null : new Date(value);
  }

  private static async clearUserDetailCache(userId: number, fastify?: FastifyInstance): Promise<void> {
    if (fastify?.redis) {
      try {
        const cacheKey = this.getUserDetailCacheKey(userId);
        await fastify.redis.del(cacheKey);
      } catch (error) {
        fastify.log.warn(`Redis缓存清除失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * 用户角色变更后失效 PermissionService 缓存。失败仅记录 warn，不影响主流程。
   */
  private static invalidatePermissionCache(roleIds: number[] = []): void {
    try {
      if (roleIds.length > 0) {
        PermissionService.invalidate(roleIds);
      } else {
        PermissionService.invalidate();
      }
    } catch (err) {
      console.warn(
        "[user.service] invalidate permission cache failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
