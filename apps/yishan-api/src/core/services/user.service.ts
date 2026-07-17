import type { FastifyInstance } from "fastify";
import { UserRepository, type CreateUserInput, type UpdateUserInput } from "../repositories/user.repository.js";
import { UserMapper } from "../mappers/user.mapper.js";
import { CreateUserReq, UserListQuery, SysUserResp, UpdateUserReq } from "../schemas/user.js";
import { UserErrorCode } from "../../constants/business-codes/user.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { CACHE_CONFIG } from "../../config/index.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { PermissionService } from "./permission.service.js";

export class UserService {
  private static readonly USER_DETAIL_CACHE_KEY_PREFIX = 'user:detail:';

  private static getUserDetailCacheKey(userId: number): string {
    return `${this.USER_DETAIL_CACHE_KEY_PREFIX}${userId}`;
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

  static async getUserById(id: number, fastify?: FastifyInstance): Promise<SysUserResp | null> {
    if (fastify?.redis) {
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

    const user = await UserRepository.findById(id);
    if (!user) return null;

    const resp = UserMapper.toDetailResp(user);

    if (fastify?.redis) {
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
    const existingUser = await UserRepository.findById(id);
    if (!existingUser) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
    }

    await this.ensureUniqueFields(userReq.username, userReq.email, userReq.phone, id);

    if (userReq.password !== undefined) {
      this.validatePassword(userReq.password);
    }

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

  static async deleteUser(id: number, fastify?: FastifyInstance): Promise<{ id: number; deleted: boolean }> {
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