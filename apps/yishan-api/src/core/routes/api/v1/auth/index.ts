import { createRouteRegistrar } from '../../../route-registrar.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "../../../../../utils/response.js";
import { getAuthMessage, AuthMessageKeys } from "../../../../../constants/messages/auth.js";
import { ValidationErrorCode } from "../../../../../constants/business-codes/validation.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import {
  LoginReq,
  RefreshTokenReq
} from "../../../../schemas/auth.js";
import { AuthService } from "../../../../services/auth.service.js";
import { MenuService } from "../../../../services/menu.service.js";
import {
  setAuthCookies,
  clearAuthCookies,
  AUTH_COOKIE_NAMES,
} from "../../../../auth/auth-helpers.js";
import { registerPermissions, type PermissionRef } from '../../../../permissions/catalog.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  LOGIN:    { code: 'auth:login',    label: '认证-登录', group: 'auth' },
  REFRESH:  { code: 'auth:refresh',  label: '认证-刷新令牌', group: 'auth' },
  LOGOUT:   { code: 'auth:logout',   label: '认证-登出', group: 'auth' },
  PROFILE:  { code: 'auth:profile',  label: '认证-当前会话', group: 'auth' },
});
registerPermissions(...Object.values(PERMS));

const auth: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  // POST /api/v1/auth/login - 用户登录
  route.post(
    "/login",
    {
      access: { permission: PERMS.LOGIN },
      // Section 7：登录限流（默认 5/min）
      preHandler: [fastify.rateLimit("login")],
      schema: {
        summary: "用户登录",
        description: "用户通过用户名/邮箱和密码进行登录认证",
        operationId: "login",
        tags: ["auth"],
        body: { $ref: "loginReq#" },
        response: {
          200: { $ref: "loginResp#" },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      // 使用AuthService进行登录验证
      const result = await AuthService.login(
        request.body as LoginReq,
        fastify,
        request.ip,
        request.headers["user-agent"] as string | undefined
      );
      const message = getAuthMessage(AuthMessageKeys.LOGIN_SUCCESS, request.headers["accept-language"] as string);
      // 浏览器场景：将令牌以 HttpOnly cookie 形式下发（响应体仍保留 token 字段，兼容非浏览器客户端）
      setAuthCookies(
        reply,
        result.token,
        result.refreshToken,
        result.expiresIn,
        result.refreshTokenExpiresIn
      );
      return ResponseUtil.success(reply, result, message);
    }
  );

  // POST /api/v1/auth/logout - 用户登出
  route.post(
    "/logout",
    {
      access: { permission: PERMS.LOGOUT },
      schema: {
        summary: "用户登出",
        description: "用户登出，清除认证状态",
        operationId: "logout",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              timestamp: { type: "string" }
            }
          },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      // 鉴权由 fastify.authenticate 完成；当前用户已绑定到 request.currentUser。
      // 仅按当前用户 ID 撤销其所有活跃 token，避免伪造 payload 触发他人登出。
      const currentUser = request.currentUser;
      if (!currentUser?.id) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "缺少认证token");
      }

      await AuthService.logout(currentUser.id, fastify);
      // 清除浏览器端认证 cookie
      clearAuthCookies(reply);
      const message = getAuthMessage(AuthMessageKeys.LOGOUT_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, null, message);
    }
  );

  // GET /api/v1/auth/me - 获取当前用户信息
  route.get(
    "/me",
    {
      access: { permission: PERMS.PROFILE },
      schema: {
        summary: "获取当前用户信息",
        description: "获取当前登录用户的详细信息",
        operationId: "getCurrentUser",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: "currentUserResp#" },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const currentUser = request.currentUser;
      const roleIds = currentUser?.roleIds ?? [];
      const accessPath = await MenuService.getAuthorizedMenuPaths(roleIds);
      const result = { ...currentUser, accessPath } as any;
      const message = getAuthMessage(AuthMessageKeys.USER_INFO_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  // POST /api/v1/auth/refresh - 刷新访问令牌
  route.post(
    "/refresh",
    {
      access: { permission: PERMS.REFRESH },
      // Section 7：refresh 限流（默认 30/min）
      preHandler: [fastify.rateLimit("refresh")],
      schema: {
        summary: "刷新访问令牌",
        description: "使用刷新令牌获取新的访问令牌和刷新令牌",
        operationId: "refreshToken",
        tags: ["auth"],
        body: { $ref: "refreshTokenReq#" },
        response: {
          200: { $ref: "refreshTokenResp#" },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      // 优先从 HttpOnly cookie 读取 refreshToken，兼容旧客户端时回退到请求体
      const refreshToken =
        request.cookies?.[AUTH_COOKIE_NAMES.refreshToken] ??
        (request.body as RefreshTokenReq | undefined)?.refreshToken;

      if (!refreshToken) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "缺少刷新令牌");
      }

      // 使用AuthService刷新令牌
      const result = await AuthService.refreshToken(refreshToken, fastify);
      // 刷新后回写新的令牌 cookie
      setAuthCookies(
        reply,
        result.token,
        result.refreshToken,
        result.expiresIn,
        result.refreshTokenExpiresIn
      );
      const message = getAuthMessage(AuthMessageKeys.REFRESH_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );
};

export default auth;
