/**
 * 用户业务逻辑服务
 */

import { SysUserModel } from "../models/sys-user.model.js";
import { CreateUserReq, UserListQuery, SysUserResp, UpdateUserReq } from "../schemas/user.js";
import { UserErrorCode } from "../constants/business-codes/user.js";
import { BusinessError } from "../exceptions/business-error.js";
import { SysUserTokenModel } from "../models/sys-user-token.model.js";

export class UserService {
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
   * 获取单个用户信息
   * @param id 用户ID
   * @returns 用户信息
   */
  static async getUserById(id: number) {
    return await SysUserModel.getUserById(id);
  }

  /**
   * 创建用户
   * @param userReq 用户数据
   * @returns 创建的用户信息
   */
  static async createUser(userReq: CreateUserReq, currentUserId: number): Promise<SysUserResp> {
    // 密码强度验证（创建场景要求提供密码）
    this.validatePassword(userReq.password);

    // 统一校验用户名/邮箱唯一性
    await this.ensureUniqueFields(userReq.username, userReq.email);

    // 创建用户
    return await SysUserModel.createUser(userReq, currentUserId);
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
   * 更新用户
   * @param id 用户ID
   * @param userReq 用户数据
   * @returns 更新的用户信息
   */
  static async updateUser(
    id: number,
    userReq: UpdateUserReq,
    currentUserId: number
  ): Promise<SysUserResp | null> {
    // 检查用户是否存在
    const existingUser = await SysUserModel.getUserById(id);
    if (!existingUser) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
    }

    // 统一校验用户名/邮箱唯一性（排除当前用户ID）
    await this.ensureUniqueFields(userReq.username, userReq.email, id);

    // 更新用户
    return await SysUserModel.updateUser(id, userReq, currentUserId);
  }

  /**
   * 删除用户（软删除）并撤销所有令牌
   */
  static async deleteUser(id: number): Promise<{ id: number; deleted: boolean }> {
    const existingUser = await SysUserModel.getUserById(id)
    if (!existingUser) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在")
    }

    const res = await SysUserModel.deleteUser(id)
    if (!res) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在或已删除")
    }

    await SysUserTokenModel.revokeAllByUserId(id)

    return { id, deleted: true }
  }

  /**
   * 统一校验用户名/邮箱的唯一性
   * @param username 可选用户名
   * @param email 可选邮箱
   * @param excludeUserId 更新场景排除的用户ID
   */
  private static async ensureUniqueFields(
    username?: string,
    email?: string,
    excludeUserId?: number
  ): Promise<void> {
    if (username) {
      const userWithSameUsername = await SysUserModel.getUserByUsername(username);
      if (userWithSameUsername && userWithSameUsername.id !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "用户名已存在");
      }
    }

    if (email) {
      const userWithSameEmail = await SysUserModel.getUserByEmail(email);
      if (userWithSameEmail && userWithSameEmail.id !== excludeUserId) {
        throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "邮箱已存在");
      }
    }
  }
}
