/**
 * 用户业务逻辑服务
 */

import { UserModel } from "../models/user.model.js";
import { SaveUserReq, UserListQuery, SysUserResp } from "../schemas/user.js";
import { SysUser } from "../generated/prisma/client.js";
import { ErrorCode } from "../constants/business-code.js";

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
    // 检查用户名是否已存在
    const existingUser = await UserModel.getUserByUsername(userReq.username);
    if (existingUser) {
      throw new Error(`${ErrorCode.USER_ALREADY_EXISTS}`);
    }

    // 检查邮箱是否已存在
    const existingEmail = await UserModel.getUserByEmail(userReq.email);
    if (existingEmail) {
      throw new Error(`${ErrorCode.USER_ALREADY_EXISTS}`);
    }

    // 创建用户
    return await UserModel.createUser(userReq);
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
      throw new Error(`${ErrorCode.USER_NOT_FOUND}`);
    }

    // 检查用户名是否已存在（如果提供了用户名）
    if (userReq.username) {
      const userWithSameUsername = await UserModel.getUserByUsername(
        userReq.username
      );
      if (userWithSameUsername && userWithSameUsername.id !== id) {
        throw new Error(`${ErrorCode.USER_ALREADY_EXISTS}`);
      }
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (userReq.email) {
      const userWithSameEmail = await UserModel.getUserByEmail(userReq.email);
      if (userWithSameEmail && userWithSameEmail.id !== id) {
        throw new Error(`${ErrorCode.USER_ALREADY_EXISTS}`);
      }
    }

    // 更新用户
    return await UserModel.updateUser(id, userReq);
  }
}
