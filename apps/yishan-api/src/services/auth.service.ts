/**
 * 认证授权业务逻辑服务
 */

import { UserModel } from "../models/user.model.js";
import { SysUserTokenModel } from "../models/user-token.model.js";
import { LoginReq, LoginData, UserProfile } from "../schemas/auth.js";
import { AuthErrorCode } from "../constants/business-codes/auth.js";
import { UserErrorCode } from "../constants/business-codes/user.js";
import { BusinessError } from "../exceptions/business-error.js";
import { prisma } from "../utils/prisma.js";
import { comparePassword } from "../utils/password.js";
import { JWT_CONFIG } from "../config/index.js";

export class AuthService {
  /**
   * 用户登录
   * @param loginReq 登录请求数据
   * @param fastify Fastify 实例（用于 JWT 签名）
   * @param ip 用户登录 IP 地址
   * @returns 登录响应数据
   */
  static async login(loginReq: LoginReq, fastify: any, ip?: string): Promise<LoginData> {
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

    // 验证密码 - 使用 scrypt 算法进行安全验证
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BusinessError(AuthErrorCode.LOGIN_FAILED, "用户名或密码错误");
    }

    // 从配置中心获取过期时间（秒）
    const accessTokenExpiresIn = rememberMe 
      ? JWT_CONFIG.accessToken.rememberMeExpiresIn 
      : JWT_CONFIG.accessToken.defaultExpiresIn;
      
    const refreshTokenExpiresIn = rememberMe 
      ? JWT_CONFIG.refreshToken.rememberMeExpiresIn 
      : JWT_CONFIG.refreshToken.defaultExpiresIn;
    
    const token = fastify.jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        real_name: user.realName,
        status: user.status,
        type: 'access_token'
      },
      { expiresIn: accessTokenExpiresIn }
    );

    // 生成刷新token（用于后续刷新访问token）
    const refreshToken = fastify.jwt.sign(
      {
        id: user.id,
        type: 'refresh_token'
      },
      { expiresIn: refreshTokenExpiresIn }
    );

    // 更新用户登录信息
    await prisma.sysUser.update({
      where: { id: user.id },
      data: {
        lastLoginTime: new Date(),
        lastLoginIp: ip || "127.0.0.1",
        loginCount: user.loginCount + 1,
        updatedAt: new Date()
      }
    });

    // 计算过期时间戳（毫秒）
    const currentTime = Date.now();
    const expiresAt = currentTime + (accessTokenExpiresIn * 1000);
    const refreshTokenExpiresAt = currentTime + (refreshTokenExpiresIn * 1000);

    // 将令牌存储到数据库
    await SysUserTokenModel.create({
      userId: user.id,
      accessToken: token,
      refreshToken: refreshToken,
      accessTokenExpiresAt: new Date(expiresAt),
      refreshTokenExpiresAt: new Date(refreshTokenExpiresAt),
      ipAddress: ip,
      userAgent: fastify?.req?.headers?.['user-agent']
    });

    // 返回登录响应数据 - 包含时间戳便于客户端判断
    return {
      token,
      refreshToken,
      expiresIn: accessTokenExpiresIn,
      refreshTokenExpiresIn: refreshTokenExpiresIn,
      expiresAt,
      refreshTokenExpiresAt
    };
  }

  /**
   * 用户登出
   * @param token JWT token
   * @param fastify Fastify 实例（用于 JWT 验证）
   */
  static async logout(token: string, fastify: any): Promise<void> {
    try {
      // 解析 token 以获取用户信息
      const decodedToken = fastify.jwt.decode(token.replace('Bearer ', ''));
      
      if (decodedToken?.id) {
        // 查找并撤销该用户的所有活跃令牌
        const activeTokens = await SysUserTokenModel.findActiveTokensByUserId(decodedToken.id);
        
        // 撤销所有活跃令牌
        for (const tokenRecord of activeTokens) {
          await SysUserTokenModel.revoke(tokenRecord.id);
        }
      }
      
    } catch (error) {
      // Token 验证失败，但仍然可以认为登出成功
      // 因为客户端将无法再使用该 token
    }
  }

  /**
   * 获取当前用户信息
   * @param token JWT token
   * @param fastify Fastify 实例（用于 JWT 验证）
   * @returns 用户信息
   */
  static async getCurrentUser(token: string, fastify: any): Promise<UserProfile> {
    try {
      // 验证和解析 JWT token
      let decodedToken;
      try {
        decodedToken = fastify.jwt.verify(token.replace('Bearer ', ''));
      } catch (jwtErr: any) {
        // JWT格式错误或签名验证失败
        if (jwtErr.code === 'FAST_JWT_MALFORMED' || jwtErr.code === 'FAST_JWT_FORMAT_INVALID') {
          throw new BusinessError(AuthErrorCode.TOKEN_INVALID, 'Token格式非法');
        }
        
        // Token过期
        if (jwtErr.code === 'FAST_JWT_EXPIRED') {
          throw new BusinessError(AuthErrorCode.TOKEN_EXPIRED, 'Token已过期');
        }
        
        // 其他JWT验证失败
        throw new BusinessError(AuthErrorCode.UNAUTHORIZED, '无效的token');
      }
      
      // 从解码的 token 中获取用户ID
      const userId = decodedToken.id;
      if (!userId || typeof userId !== 'number') {
        throw new BusinessError(AuthErrorCode.TOKEN_INVALID, '无效的用户ID');
      }
      
      // 验证令牌是否在数据库中存在且有效
      const tokenRecord = await SysUserTokenModel.findByAccessToken(token.replace('Bearer ', ''));
      if (!tokenRecord) {
        throw new BusinessError(AuthErrorCode.TOKEN_INVALID, '令牌不存在或已失效');
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
   * 刷新访问令牌
   * @param refreshToken 刷新令牌
   * @param fastify Fastify 实例（用于 JWT 验证和签名）
   * @returns 新的访问令牌和刷新令牌
   */
  static async refreshToken(refreshToken: string, fastify: any): Promise<LoginData> {
    try {
      // 验证刷新令牌
      let decodedToken;
      try {
        decodedToken = fastify.jwt.verify(refreshToken);
      } catch (jwtErr: any) {
        // JWT格式错误或签名验证失败
        if (jwtErr.code === 'FAST_JWT_MALFORMED' || jwtErr.code === 'FAST_JWT_FORMAT_INVALID') {
          throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_INVALID, '刷新令牌格式非法');
        }
        
        // Token过期
        if (jwtErr.code === 'FAST_JWT_EXPIRED') {
          throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_EXPIRED, '刷新令牌已过期');
        }
        
        // 其他JWT验证失败
        throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_INVALID, '无效的刷新令牌');
      }
      
      // 检查是否为刷新令牌
      if (decodedToken.type !== 'refresh_token') {
        throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_INVALID, '令牌类型错误');
      }
      
      // 从解码的 token 中获取用户ID
      const userId = decodedToken.id;
      if (!userId || typeof userId !== 'number') {
        throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_INVALID, '无效的用户ID');
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

      // 查找现有的令牌记录
      const existingToken = await SysUserTokenModel.findByRefreshToken(refreshToken);
      if (!existingToken) {
        throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_INVALID, '刷新令牌不存在或已失效');
      }

      // 生成新的访问令牌（使用默认过期时间，不继承记住我状态）
      const accessTokenExpiresIn = JWT_CONFIG.accessToken.defaultExpiresIn;
      const refreshTokenExpiresIn = JWT_CONFIG.refreshToken.defaultExpiresIn;
      
      const newAccessToken = fastify.jwt.sign(
        {
          id: user.id,
          email: user.email,
          username: user.username,
          real_name: user.realName,
          status: user.status,
          type: 'access_token'
        },
        { expiresIn: accessTokenExpiresIn }
      );

      // 生成新的刷新令牌
      const newRefreshToken = fastify.jwt.sign(
        {
          id: user.id,
          type: 'refresh_token'
        },
        { expiresIn: refreshTokenExpiresIn }
      );

      // 计算过期时间戳（毫秒）
      const currentTime = Date.now();
      const expiresAt = currentTime + (accessTokenExpiresIn * 1000);
      const refreshTokenExpiresAt = currentTime + (refreshTokenExpiresIn * 1000);

      // 更新数据库中的令牌记录
      await SysUserTokenModel.update(existingToken.id, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiresAt: new Date(expiresAt),
        refreshTokenExpiresAt: new Date(refreshTokenExpiresAt)
      });

      // 返回新的令牌
      return {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: accessTokenExpiresIn,
        refreshTokenExpiresIn: refreshTokenExpiresIn,
        expiresAt,
        refreshTokenExpiresAt
      };
      
    } catch (error) {
      if (error instanceof BusinessError) {
        throw error;
      }
      
      throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_INVALID, "刷新令牌验证失败");
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