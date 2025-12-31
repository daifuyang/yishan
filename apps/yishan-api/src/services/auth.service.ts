/**
 * 认证授权业务逻辑服务
 */

import { SysUserModel } from "../models/sys-user.model.js";
import { SysUserTokenModel } from "../models/sys-user-token.model.js";
import { LoginReq, LoginData } from "../schemas/auth.js";
import { AuthErrorCode } from "../constants/business-codes/auth.js";
import { UserErrorCode } from "../constants/business-codes/user.js";
import { BusinessError } from "../exceptions/business-error.js";
import { prisma } from "../utils/prisma.js";
import { comparePassword } from "../utils/password.js";
import { JWT_CONFIG } from "../config/index.js";
import { dateUtils } from "../utils/date.js";
import { LoginLogService } from "./login-log.service.js";

export class AuthService {
  /**
   * 用户登录
   * @param loginReq 登录请求数据
   * @param fastify Fastify 实例（用于 JWT 签名）
   * @param ip 用户登录 IP 地址
   * @returns 登录响应数据
   */
  static async login(loginReq: LoginReq, fastify: any, ip?: string, userAgent?: string): Promise<LoginData> {
    const { username, password, rememberMe } = loginReq;
    let user: any | null = null;

    try {
      user = await SysUserModel.getRawUserByUsernameOrEmail(username);

      if (!user) {
        throw new BusinessError(AuthErrorCode.LOGIN_FAILED, "用户名或密码错误");
      }

      if (user.status === 0) {
        throw new BusinessError(UserErrorCode.USER_DISABLED, "账号已被禁用");
      }

      if (user.status === 2) {
        throw new BusinessError(AuthErrorCode.ACCOUNT_LOCKED, "账号已被锁定");
      }

      const isPasswordValid = await comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new BusinessError(AuthErrorCode.LOGIN_FAILED, "用户名或密码错误");
      }

      const accessTokenExpiresIn = rememberMe
        ? JWT_CONFIG.accessToken.rememberMeExpiresIn
        : JWT_CONFIG.accessToken.defaultExpiresIn;

      const refreshTokenExpiresIn = rememberMe
        ? JWT_CONFIG.refreshToken.rememberMeExpiresIn
        : JWT_CONFIG.refreshToken.defaultExpiresIn;

      const token = fastify.jwt.sign(
        {
          id: user.id,
          type: 'access_token'
        },
        { expiresIn: accessTokenExpiresIn }
      );

      const refreshToken = fastify.jwt.sign(
        {
          id: user.id,
          type: 'refresh_token'
        },
        { expiresIn: refreshTokenExpiresIn }
      );

      await prisma.sysUser.update({
        where: { id: user.id },
        data: {
          lastLoginTime: dateUtils.now(),
          lastLoginIp: ip || "127.0.0.1",
          loginCount: user.loginCount + 1,
          updatedAt: dateUtils.now()
        }
      });

      const currentTime = dateUtils.nowUnix();
      const expiresAt = currentTime + accessTokenExpiresIn;
      const refreshTokenExpiresAt = currentTime + refreshTokenExpiresIn;

      await SysUserTokenModel.create({
        userId: user.id,
        accessToken: token,
        refreshToken: refreshToken,
        accessTokenExpiresAt: dateUtils.toDate(expiresAt * 1000)!,
        refreshTokenExpiresAt: dateUtils.toDate(refreshTokenExpiresAt * 1000)!,
        ipAddress: ip,
        userAgent,
      });

      await LoginLogService.writeLoginLog({
        userId: user.id,
        username,
        realName: user.realName ?? null,
        status: 1,
        message: "登录成功",
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      });

      return {
        token,
        refreshToken,
        expiresIn: accessTokenExpiresIn,
        refreshTokenExpiresIn: refreshTokenExpiresIn,
        expiresAt,
        refreshTokenExpiresAt
      };
    } catch (error) {
      const message = error instanceof BusinessError ? error.message : "登录失败";
      await LoginLogService.writeLoginLog({
        userId: user?.id ?? null,
        username,
        realName: user?.realName ?? null,
        status: 0,
        message,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      });

      throw error;
    }
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
      const user = await SysUserModel.getUserById(userId);

      if (!user) {
        throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
      }

      // 检查用户状态
      if (user.status === "0") {
        throw new BusinessError(UserErrorCode.USER_DISABLED, "账号已被禁用");
      }

      if (user.status === "2") {
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

      // 计算过期时间戳（秒级，10位）
      const currentTime = dateUtils.nowUnix();
      const expiresAt = currentTime + accessTokenExpiresIn;
      const refreshTokenExpiresAt = currentTime + refreshTokenExpiresIn;

      // 更新数据库中的令牌记录
      await SysUserTokenModel.update(existingToken.id, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        // 秒级时间戳转回毫秒用于存库
        accessTokenExpiresAt: dateUtils.toDate(expiresAt * 1000)!,
        refreshTokenExpiresAt: dateUtils.toDate(refreshTokenExpiresAt * 1000)!
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
}
