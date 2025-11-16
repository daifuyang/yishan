import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "../../../../utils/response.js";
import { getAuthMessage, AuthMessageKeys } from "../../../../constants/messages/auth.js";
import { ValidationErrorCode } from "../../../../constants/business-codes/validation.js";
import { BusinessError } from "../../../../exceptions/business-error.js";
import {
  LoginReq,
  RefreshTokenReq
} from "../../../../schemas/auth.js";
import { AuthService } from "../../../../services/auth.service.js";
import { MenuService } from "../../../../services/menu.service.js";

const auth: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // POST /api/v1/auth/login - 用户登录
  fastify.post(
    "/login",
    {
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
      request: FastifyRequest<{ Body: LoginReq }>,
      reply: FastifyReply
    ) => {
      // 使用AuthService进行登录验证
      const result = await AuthService.login(request.body, fastify, request.ip);
      const message = getAuthMessage(AuthMessageKeys.LOGIN_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  // POST /api/v1/auth/logout - 用户登出
  fastify.post(
    "/logout",
    {
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
      // 从请求头获取token
      const token = request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "缺少认证token");
      }

      // 使用AuthService进行登出处理
      await AuthService.logout(token, fastify);
      const message = getAuthMessage(AuthMessageKeys.LOGOUT_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, null, message);
    }
  );

  // GET /api/v1/auth/me - 获取当前用户信息
  fastify.get(
    "/me",
    {
      preHandler: fastify.authenticate,
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
  fastify.post(
    "/refresh",
    {
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
      request: FastifyRequest<{ Body: RefreshTokenReq }>,
      reply: FastifyReply
    ) => {
      const { refreshToken } = request.body;

      if (!refreshToken) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "缺少刷新令牌");
      }

      // 使用AuthService刷新令牌
      const result = await AuthService.refreshToken(refreshToken, fastify);
      const message = getAuthMessage(AuthMessageKeys.REFRESH_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );
};

export default auth;