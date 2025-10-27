/**
 * 认证授权业务逻辑服务
 */

import { UserModel } from "../models/user.model.js";
import { LoginReq, LoginData, UserProfile } from "../schemas/auth.js";
import { AuthErrorCode } from "../constants/business-codes/auth.js";
import { UserErrorCode } from "../constants/business-codes/user.js";
import { BusinessError } from "../exceptions/business-error.js";
import { prisma } from "../utils/prisma.js";

export class AuthService {
  /**
   * 用户登录
   * @param loginReq 登录请求数据
   * @returns 登录响应数据
   */
  static async login(loginReq: LoginReq): Promise<LoginData> {
    const { username, password, rememberMe } = loginReq;

    // 根据用户名或邮箱查找用户
    const user = await UserModel.getUserByUsernameOrEmail(username);
    
    if (!user) {
      throw new BusinessError(AuthErrorCode.LOGIN_FAILED, "用户名或密码错误");
    }

    // 检查用户状态
    if (user.status === 0) {
      throw new BusinessError(UserErrorCode.USER_DISABLED, "账号已被禁用");
    }
    
    if (user.status === 2) {
      throw new BusinessError(AuthErrorCode.ACCOUNT_LOCKED, "账号已被锁定");
    }

    // 验证密码 - 简化处理，实际项目中应该使用bcrypt
    // 这里假设数据库中存储的是明文密码（仅用于演示）
    if (user.passwordHash !== password) {
      throw new BusinessError(AuthErrorCode.LOGIN_FAILED, "用户名或密码错误");
    }

    // 生成JWT token - 使用简单的payload
    const expiresInSeconds = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    
    // 这里返回一个模拟的token，实际项目中应该使用fastify.jwt.sign
    const token = `mock_token_${user.id}_${Date.now()}`;

    // 更新用户登录信息
    await prisma.sysUser.update({
      where: { id: user.id },
      data: {
        lastLoginTime: new Date(),
        lastLoginIp: "127.0.0.1", // 实际项目中应该从request中获取真实IP
        loginCount: user.loginCount + 1,
        updatedAt: new Date()
      }
    });

    // 返回登录响应数据
    return {
      token,
      expiresIn: expiresInSeconds,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        realName: user.realName,
        avatar: user.avatar || undefined,
        status: user.status,
        statusName: this.getStatusName(user.status)
      }
    };
  }

  /**
   * 用户登出
   * @param token JWT token
   */
  static async logout(token: string): Promise<void> {
    // 简化处理，验证token格式
    if (!token.startsWith('mock_token_')) {
      throw new BusinessError(AuthErrorCode.TOKEN_INVALID, "无效的token");
    }
    
    // 在实际项目中，这里可以将token加入黑名单
    // 或者在Redis中记录已登出的token
  }

  /**
   * 获取当前用户信息
   * @param token JWT token
   * @returns 用户信息
   */
  static async getCurrentUser(token: string): Promise<UserProfile> {
    try {
      // 简化的token验证和解析
      if (!token.startsWith('mock_token_')) {
        throw new BusinessError(AuthErrorCode.TOKEN_INVALID, "无效的token");
      }
      
      // 从token中提取用户ID
      const parts = token.split('_');
      if (parts.length < 3) {
        throw new BusinessError(AuthErrorCode.TOKEN_INVALID, "token格式错误");
      }
      
      const userId = parseInt(parts[2]);
      if (isNaN(userId)) {
        throw new BusinessError(AuthErrorCode.TOKEN_INVALID, "无效的用户ID");
      }
      
      // 根据用户ID获取最新用户信息
      const user = await UserModel.getUserById(userId);
      
      if (!user) {
        throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
      }

      // 检查用户状态
      if (user.status === 0) {
        throw new BusinessError(UserErrorCode.USER_DISABLED, "账号已被禁用");
      }
      
      if (user.status === 2) {
        throw new BusinessError(AuthErrorCode.ACCOUNT_LOCKED, "账号已被锁定");
      }

      // 返回用户信息
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone || undefined,
        realName: user.realName,
        avatar: user.avatar || undefined,
        gender: user.gender,
        genderName: this.getGenderName(user.gender),
        birthDate: user.birthDate ? user.birthDate.toISOString().split('T')[0] : undefined,
        status: user.status,
        statusName: this.getStatusName(user.status),
        lastLoginTime: user.lastLoginTime?.toISOString(),
        lastLoginIp: user.lastLoginIp || undefined,
        loginCount: user.loginCount,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      };
      
    } catch (error) {
      if (error instanceof BusinessError) {
        throw error;
      }
      
      throw new BusinessError(AuthErrorCode.TOKEN_INVALID, "token验证失败");
    }
  }

  /**
   * 获取状态名称
   * @param status 状态码
   * @returns 状态名称
   */
  private static getStatusName(status: number): string {
    switch (status) {
      case 0: return "禁用";
      case 1: return "启用";
      case 2: return "锁定";
      default: return "未知";
    }
  }

  /**
   * 获取性别名称
   * @param gender 性别码
   * @returns 性别名称
   */
  private static getGenderName(gender: number): string {
    switch (gender) {
      case 0: return "未知";
      case 1: return "男";
      case 2: return "女";
      default: return "未知";
    }
  }
}