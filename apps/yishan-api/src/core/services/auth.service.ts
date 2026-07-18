/**
 * 认证授权业务逻辑服务
 */

import type { FastifyInstance } from "fastify";
import { UserRepository, type LoginAuthInfo } from "../repositories/user.repository.js";
import { UserTokenRepository } from "../repositories/user-token.repository.js";
import { LoginReq, LoginData } from "../schemas/auth.js";
import { AuthErrorCode } from "../../constants/business-codes/auth.js";
import { UserErrorCode } from "../../constants/business-codes/user.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { JWT_CONFIG } from "../../config/index.js";
import { dateUtils } from "../../utils/date.js";
import { LoginLogService } from "./login-log.service.js";

export class AuthService {
  /**
   * 用户登录
   * @param loginReq 登录请求数据
   * @param fastify Fastify 实例（用于 JWT 签名）
   * @param ip 用户登录 IP 地址
   * @returns 登录响应数据
   */
  static async login(loginReq: LoginReq, fastify: FastifyInstance, ip?: string, userAgent?: string): Promise<LoginData> {
    const { username, password, rememberMe } = loginReq;
    let user: LoginAuthInfo | null = null;

    try {
      user = await UserRepository.findAuthIdentityByLogin(username);

      if (!user) {
        throw new BusinessError(AuthErrorCode.LOGIN_FAILED, "用户名或密码错误");
      }

      if (user.status === 0) {
        throw new BusinessError(UserErrorCode.USER_DISABLED, "账号已被禁用");
      }

      if (user.status === 2) {
        throw new BusinessError(AuthErrorCode.ACCOUNT_LOCKED, "账号已被锁定");
      }

      const passwordVerification = await verifyPassword(password, user.passwordHash);
      if (!passwordVerification.valid) {
        throw new BusinessError(AuthErrorCode.LOGIN_FAILED, "用户名或密码错误");
      }

      if (passwordVerification.needsRehash) {
        await UserRepository.upgradePasswordHash(user.id, user.passwordHash, await hashPassword(password));
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

      await UserRepository.recordSuccessfulLogin(user.id, ip || "127.0.0.1");

      const currentTime = dateUtils.nowUnix();
      const expiresAt = currentTime + accessTokenExpiresIn;
      const refreshTokenExpiresAt = currentTime + refreshTokenExpiresIn;

      await UserTokenRepository.create({
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
   *
   * 仅按 userId 撤销该用户的所有活跃 token 记录。userId 已由路由层的
   * `preHandler: fastify.authenticate` 校验过 JWT 签名、确认 token 未撤销、
   * 用户未被禁用/锁定，因此本方法不再做任何签名/状态校验，避免 jwt.decode()
   * 不验签导致的伪造 payload 攻击。
   *
   * @param userId 当前已鉴权用户的 ID（来自 request.currentUser.id）
   * @param _fastify Fastify 实例（保留以兼容既有调用方签名；当前实现不依赖）
   */
  static async logout(userId: number, _fastify: FastifyInstance): Promise<void> {
    if (!userId || typeof userId !== 'number') {
      throw new BusinessError(AuthErrorCode.UNAUTHORIZED, '缺少有效的用户身份，无法登出');
    }

    const activeTokens = await UserTokenRepository.findActiveTokensByUserId(userId);
    await Promise.all(activeTokens.map((tokenRecord) => UserTokenRepository.revoke(tokenRecord.id)));
  }

  /**
   * 刷新访问令牌
   * @param refreshToken 刷新令牌
   * @param fastify Fastify 实例（用于 JWT 验证和签名）
   * @returns 新的访问令牌和刷新令牌
   */
  static async refreshToken(refreshToken: string, fastify: FastifyInstance): Promise<LoginData> {
    try {
      // 验证刷新令牌
      let decodedToken;
      try {
        decodedToken = fastify.jwt.verify<{ id?: number; type?: string }>(refreshToken);
      } catch (jwtErr: unknown) {
        const errCode = (jwtErr as { code?: string })?.code;
        // JWT格式错误或签名验证失败
        if (errCode === 'FAST_JWT_MALFORMED' || errCode === 'FAST_JWT_FORMAT_INVALID') {
          throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_INVALID, '刷新令牌格式非法');
        }

        // Token过期
        if (errCode === 'FAST_JWT_EXPIRED') {
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
      const user = await UserRepository.findById(userId);

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
      const existingToken = await UserTokenRepository.findByRefreshToken(refreshToken);
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
      await UserTokenRepository.update(existingToken.id, {
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
