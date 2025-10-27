/**
 * 用户业务逻辑服务
 */

import { UserModel } from "../models/user.model.js";
import { SaveUserReq, UserListQuery, SysUserResp } from "../schemas/user.js";
import { SysUser } from "../generated/prisma/client.js";
import { UserErrorCode } from "../constants/business-codes/user.js";
import { BusinessError } from "../exceptions/business-error.js";

export class UserService {
  /**
   * 获取管理员列表
   * @param query 查询参数
   * @returns 管理员列表和总数
   */
  static async getUserList(query: UserListQuery) {
    // 获取用户列表
    const list = await UserModel.getUserList(query);

    // 获取总数量
    const total = await UserModel.getUserTotal(query);

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
    return await UserModel.getUserById(id);
  }

  /**
   * 创建用户
   * @param userReq 用户数据
   * @returns 创建的用户信息
   */
  static async createUser(userReq: SaveUserReq): Promise<SysUserResp> {
    // 密码强度验证
    this.validatePassword(userReq.password);

    // 检查用户名是否已存在
    const existingUser = await UserModel.getUserByUsername(userReq.username);
    if (existingUser) {
      throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "用户名已存在");
    }

    // 检查邮箱是否已存在
    const existingEmail = await UserModel.getUserByEmail(userReq.email);
    if (existingEmail) {
      throw new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "邮箱已存在");
    }

    // 创建用户
    return await UserModel.createUser(userReq);
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
    userReq: SaveUserReq
  ): Promise<SysUser | null> {
    // 检查用户是否存在
    const existingUser = await UserModel.getUserById(id);
    if (!existingUser) {
      throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
    }

    // 检查用户名是否已存在（如果提供了用户名）
    if (userReq.username) {
      const userWithSameUsername = await UserModel.getUserByUsername(
        userReq.username
      );
      if (userWithSameUsername && userWithSameUsername.id !== id) {
        throw new Error(`${UserErrorCode.USER_ALREADY_EXISTS}`);
      }
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (userReq.email) {
      const userWithSameEmail = await UserModel.getUserByEmail(userReq.email);
      if (userWithSameEmail && userWithSameEmail.id !== id) {
        throw new Error(`${UserErrorCode.USER_ALREADY_EXISTS}`);
      }
    }

    // 更新用户
    return await UserModel.updateUser(id, userReq);
  }
}
