import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../constants/business-codes/validation.js";
import { BusinessError } from "../../../../exceptions/business-error.js";
import {
  LoginReq
} from "../../../../schemas/auth.js";
import { AuthService } from "../../../../services/auth.service.js";

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
      const result = await AuthService.login(request.body);
      return ResponseUtil.success(reply, result, "登录成功");
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
      await AuthService.logout(token);
      return ResponseUtil.success(reply, null, "登出成功");
    }
  );

  // GET /api/v1/auth/me - 获取当前用户信息
  fastify.get(
    "/me",
    {
      schema: {
        summary: "获取当前用户信息",
        description: "获取当前登录用户的详细信息",
        operationId: "getCurrentUser",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: "userProfileResp#" },
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

      // 使用AuthService获取用户信息
      const user = await AuthService.getCurrentUser(token);
      return ResponseUtil.success(reply, user, "获取用户信息成功");
    }
  );
};

export default auth;