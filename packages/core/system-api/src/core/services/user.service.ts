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
import { validateUserCreation } from "./user-creation-policy.js";
import { currentDataScope } from "@/core/auth/data-scope";

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

  static async createUser(userReq: CreateUserReq, currentUserId: number, fastify?: FastifyInstance): Promise<SysUserResp> {
    this.validatePassword(userReq.password);
    await this.ensureUniqueFields(userReq.username, userReq.email, userReq.phone);

    // 统一的创建授权规则：角色组合的权限码与数据范围、部门关联都必须落在
    // 当前请求身份内。与 AI 草稿提交共用同一份实现，不存在「宽松版本」。
    await validateUserCreation(
      { actorId: currentUserId, tokenScope: currentDataScope()?.tokenScope },
      userReq,
    );

    await currentSystemRuntime().validateUser({ operation: 'create', actorId: currentUserId, fields: { ...userReq } });
    const input = await this.toCreateUserInput(userReq, currentUserId);
    const createdUser = await UserRepository.createInTransaction(input);
    const resp = UserMapper.toDetailResp(createdUser);

    if (fastify?.redis) {
      try {
        const cacheKey = this.getUserDetailCacheKey(createdUser.id);
        await fastify.redis.setex(cacheKey, CACHE_CONFIG.defaultTTLSeconds, JSON.stringify(resp));
      } catch (error) {
        fastify.log.warn(`创建用户后写入缓存失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Section 1 — RBAC：用户新建时若分配了角色，全局失效权限缓存以确保立即生效。
    UserService.invalidatePermissionCache(createdUser.roleIds);
    await currentSystemRuntime().notifyUser({ type: 'user.created', actorId: currentUserId, user: resp });

    return resp;
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
    excludeUserId?: number
  ): Promise<void> {
    if (username !== undefined) {
      const userId = await UserRepository.findIdByUsername(username);
      if (userId !== null && userId !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "用户名已存在");
      }
    }

    if (email !== undefined) {
      const userId = await UserRepository.findIdByEmail(email);
      if (userId !== null && userId !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "邮箱已存在");
      }
    }

    if (phone !== undefined) {
      const userId = await UserRepository.findIdByPhone(phone);
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
