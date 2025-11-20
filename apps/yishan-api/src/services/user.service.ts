/**
 * 用户业务逻辑服务
 */

import { SysUserModel } from "../models/sys-user.model.js";
import { CreateUserReq, UserListQuery, SysUserResp, UpdateUserReq } from "../schemas/user.js";
import { UserErrorCode } from "../constants/business-codes/user.js";
import { BusinessError } from "../exceptions/business-error.js";
import { SysUserTokenModel } from "../models/sys-user-token.model.js";
import { CACHE_CONFIG } from "../config/index.js";

export class UserService {
  private static readonly USER_DETAIL_CACHE_KEY_PREFIX = 'user:detail:';

  /**
   * 获取用户详情缓存键
   */
  private static getUserDetailCacheKey(userId: number): string {
    return `${this.USER_DETAIL_CACHE_KEY_PREFIX}${userId}`;
  }

  /**
   * 获取管理员列表
   * @param query 查询参数
   * @returns 管理员列表和总数
   */
  static async getUserList(query: UserListQuery) {
    // 获取用户列表
    const list = await SysUserModel.getUserList(query);

    // 获取总数量
    const total = await SysUserModel.getUserTotal(query);

    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  /**
   * 获取单个用户信息（默认带缓存）
   * @param id 用户ID
   * @param fastify Fastify实例（可选，用于缓存）
   * @returns 用户信息
   */
  static async getUserById(id: number, fastify?: any): Promise<SysUserResp | null> {
    // 如果提供了fastify实例，尝试使用缓存
    if (fastify?.redis) {
      try {
        const cacheKey = this.getUserDetailCacheKey(id);
        const cached = await fastify.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        // 缓存失败不影响主流程，记录日志即可
        fastify.log.warn(`Redis缓存获取失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 从数据库获取数据
    const user = await SysUserModel.getUserById(id);

    // 如果提供了fastify实例，将结果存入缓存
    if (fastify?.redis && user) {
      try {
        const cacheKey = this.getUserDetailCacheKey(id);
        await fastify.redis.setex(cacheKey, CACHE_CONFIG.defaultTTLSeconds, JSON.stringify(user));
      } catch (error) {
        // 缓存失败不影响主流程，记录日志即可
        fastify.log.warn(`Redis缓存设置失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return user;
  }

  /**
   * 创建用户（默认带缓存）
   * @param userReq 用户数据
   * @param currentUserId 当前用户ID
   * @param fastify Fastify实例（可选，用于缓存）
   * @returns 创建的用户信息
   */
  static async createUser(userReq: CreateUserReq, currentUserId: number, fastify?: any): Promise<SysUserResp> {
    // 密码强度验证（创建场景要求提供密码）
    this.validatePassword(userReq.password);

    // 校验用户名/邮箱/手机号的唯一性
    await this.ensureUniqueFields(userReq.username, userReq.email, userReq.phone);

    // 创建用户
    const user = await SysUserModel.createUser(userReq, currentUserId);
    
    // 写入缓存
    if (fastify?.redis && user && typeof user.id === "number") {
      try {
        const cacheKey = this.getUserDetailCacheKey(user.id);
        await fastify.redis.setex(cacheKey, CACHE_CONFIG.defaultTTLSeconds, JSON.stringify(user));
      } catch (error) {
        // 缓存失败不影响主流程，记录日志即可
        fastify.log.warn(`创建用户后写入缓存失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return user;
  }

  /**
   * 验证密码强度
   * @param password 密码
   */
  private static validatePassword(password: string): void {
    // 密码长度检查
    if (password.length < 6 || password.length > 50) {
      throw new BusinessError(UserErrorCode.PASSWORD_WEAK, "密码长度必须在6-50个字符之间");
    }

    // 密码复杂度检查：至少包含字母和数字
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    if (!hasLetter || !hasNumber) {
      throw new BusinessError(UserErrorCode.PASSWORD_WEAK, "密码必须包含至少一个字母和一个数字");
    }

    // 检查是否包含不安全的字符
    const allowedChars = /^[a-zA-Z\d@$!%*?&]+$/;
    if (!allowedChars.test(password)) {
      throw new BusinessError(UserErrorCode.PASSWORD_WEAK, "密码只能包含字母、数字和特殊字符(@$!%*?&)");
    }
  }

  /**
   * 更新用户（默认带缓存刷新）
   * @param id 用户ID
   * @param userReq 用户数据
   * @param currentUserId 当前用户ID
   * @param fastify Fastify实例（可选，用于缓存）
   * @returns 更新的用户信息
   */
  static async updateUser(
    id: number,
    userReq: UpdateUserReq,
    currentUserId: number,
    fastify?: any
  ): Promise<SysUserResp | null> {
    // 检查用户是否存在
    const existingUser = await SysUserModel.getUserById(id);
    if (!existingUser) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
    }

    // 统一校验用户名/邮箱/手机号唯一性（排除当前用户ID）
    await this.ensureUniqueFields(userReq.username, userReq.email, userReq.phone, id);

    // 若传入密码，进行强度校验
    if (userReq.password !== undefined) {
      this.validatePassword(userReq.password);
    }

    // 更新用户
    const user = await SysUserModel.updateUser(id, userReq, currentUserId);
    
    // 更新成功后刷新缓存
    if (user && fastify?.redis) {
      try {
        const cacheKey = this.getUserDetailCacheKey(id);
        await fastify.redis.setex(cacheKey, CACHE_CONFIG.defaultTTLSeconds, JSON.stringify(user));
      } catch (error) {
        // 缓存刷新失败不影响主流程，记录日志即可
        fastify.log.warn(`更新用户后刷新缓存失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return user;
  }

  /**
   * 删除用户（软删除）并撤销所有令牌（默认带缓存清除）
   * @param id 用户ID
   * @param fastify Fastify实例（可选，用于缓存）
   */
  static async deleteUser(id: number, fastify?: any): Promise<{ id: number; deleted: boolean }> {
    const existingUser = await SysUserModel.getUserById(id)
    if (!existingUser) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在")
    }

    const res = await SysUserModel.deleteUser(id)
    if (!res) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在或已删除")
    }

    await SysUserTokenModel.revokeAllByUserId(id)

    // 清除缓存
    await this.clearUserDetailCache(id, fastify);

    return { id, deleted: true }
  }

  /**
   * 统一校验用户名/邮箱/手机号的唯一性
   * @param username 可选用户名
   * @param email 可选邮箱
   * @param phone 可选手机号
   * @param excludeUserId 更新场景排除的用户ID
   */
  private static async ensureUniqueFields(
    username?: string,
    email?: string,
    phone?: string,
    excludeUserId?: number
  ): Promise<void> {
    if (username !== undefined) {
      const userWithSameUsername = await SysUserModel.getUserByUsername(username);
      if (userWithSameUsername && userWithSameUsername.id !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "用户名已存在");
      }
    }

    if (email !== undefined) {
      const userWithSameEmail = await SysUserModel.getUserByEmail(email);
      if (userWithSameEmail && userWithSameEmail.id !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "邮箱已存在");
      }
    }

    if (phone !== undefined) {
      const userWithSamePhone = await SysUserModel.getUserByPhone(phone);
      if (userWithSamePhone && userWithSamePhone.id !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "手机号已存在");
      }
    }
  }

  /**
   * 清除用户详情缓存
   * @param userId 用户ID
   * @param fastify Fastify实例（可选）
   */
  private static async clearUserDetailCache(userId: number, fastify?: any): Promise<void> {
    if (fastify?.redis) {
      try {
        const cacheKey = this.getUserDetailCacheKey(userId);
        await fastify.redis.del(cacheKey);
      } catch (error) {
        // 缓存清除失败不影响主流程，记录日志即可
        fastify.log.warn(`Redis缓存清除失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
