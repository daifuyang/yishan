import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import {
  UserListQuery,
  CreateUserReq,
  UpdateUserReq
} from "../../../../../schemas/user.js";
import { UserService } from "../../../../../services/user.service.js";
import { UserErrorCode } from "../../../../../constants/business-codes/user.js";
import { getUserMessage, UserMessageKeys } from "../../../../../constants/messages/user.js";

const sysUser: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/v1/admin/user - 获取管理员用户列表
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取管理员用户列表",
        description: "分页获取系统用户列表，支持关键词搜索和状态筛选",
        operationId: "getUserList",
        tags: ["sysUsers"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "userListQuery#" },
        response: {
          200: { $ref: "userListResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: UserListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;

      // 使用UserService获取管理员列表 
      const result = await UserService.getUserList(request.query);

      const message = getUserMessage(UserMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(
        reply,
        result.list,
        page,
        pageSize,
        result.total,
        message
      );
    }
  );

  // GET /api/v1/admin/user/{id} - 获取用户详情
  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取用户详情",
        description: "根据用户ID获取用户详情",
        operationId: "getUserDetail",
        tags: ["sysUsers"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.Integer({ description: "用户ID", minimum: 1 }),
        }),
        response: {
          200: { $ref: "userDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number } }>,
      reply: FastifyReply
    ) => {
      const userId = request.params.id;
      
      // 使用UserService获取用户详情（带缓存）
      const user = await UserService.getUserById(userId, fastify);
      if (!user) {
        throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在或已删除");
      }

      const message = getUserMessage(UserMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, user, message);
    }
  );

  // POST /api/v1/admin/user - 创建用户
  fastify.post(
    "/",
    {
      schema: {
        summary: "创建用户",
        description: "创建一个新的系统用户",
        operationId: "createUser",
        tags: ["sysUsers"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "createUserReq#" },
        response: {
          200: { $ref: "userDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateUserReq }>,
      reply: FastifyReply
    ) => {
      // 使用UserService创建用户（带缓存写入），异常将由全局异常处理器处理
      const user = await UserService.createUser(request.body, request.currentUser.id, fastify);
      
      const message = getUserMessage(UserMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, user, message);
    }
  );

  // PUT /api/v1/admin/user/{id} - 更新用户
  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新用户",
        description: "根据用户ID更新用户信息",
        operationId: "updateUser",
        tags: ["sysUsers"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.Integer({ description: "用户ID", minimum: 1 }),
        }),
        body: { $ref: "updateUserReq#" },
        response: {
          200: { $ref: "userDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: number };
        Body: UpdateUserReq;
      }>,
      reply: FastifyReply
    ) => {
      const userId = request.params.id;

      // 禁用限制：不允许禁用超级管理员（ID=1）或当前登录用户自身
      const nextStatus = request.body?.status;
      if (nextStatus === "0") {
        if (userId === 1) {
          throw new BusinessError(
            UserErrorCode.USER_STATUS_ERROR,
            "系统管理员不可禁用"
          );
        }
        if (request.currentUser && request.currentUser.id === userId) {
          throw new BusinessError(
            UserErrorCode.USER_STATUS_ERROR,
            "不能禁用当前登录用户"
          );
        }
      }

      // 使用UserService更新用户（带缓存刷新），异常将由全局异常处理器处理
      const user = await UserService.updateUser(userId, request.body, request.currentUser.id, fastify);

      const message = getUserMessage(UserMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, user, message);
    }
  );

  // DELETE /api/v1/admin/user/{id} - 删除用户（软删除）
  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除用户",
        description: "根据用户ID进行软删除，并撤销所有令牌",
        operationId: "deleteUser",
        tags: ["sysUsers"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.Integer({ description: "用户ID", minimum: 1 }),
        }),
        response: {
          200: { $ref: "userDeleteResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number } }>,
      reply: FastifyReply
    ) => {
      const userId = request.params.id;

      // 删除限制：不允许删除超级管理员（ID=1）或当前登录用户自身
      if (userId === 1) {
        throw new BusinessError(
          UserErrorCode.USER_STATUS_ERROR,
          "系统管理员不可删除"
        );
      }
      if (request.currentUser && request.currentUser.id === userId) {
        throw new BusinessError(
          UserErrorCode.USER_STATUS_ERROR,
          "不能删除当前登录用户"
        );
      }

      // 使用UserService删除用户（带缓存清除）
      const result = await UserService.deleteUser(userId, fastify);

      const message = getUserMessage(UserMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );
};

export default sysUser;
