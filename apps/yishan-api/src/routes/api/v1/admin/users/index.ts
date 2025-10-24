import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ErrorCode } from "../../../../../constants/business-code.js";
import {
  UserListQuery,
  SaveUserReq
} from "../../../../../schemas/user.js";
import { UserService } from "../../../../../services/user.service.js";

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
      try {
        const { page, pageSize } = request.query;

        // 使用UserService获取管理员列表 
        const result = await UserService.getUserList(request.query);

        return ResponseUtil.sendPaginated(
          reply,
          result.list,
          page,
          pageSize,
          result.total,
          "获取用户列表成功"
        );
      } catch (error: unknown) {
        fastify.log.error(error);
        return ResponseUtil.sendError(
          reply,
          ErrorCode.DATABASE_ERROR,
          "获取用户列表失败"
        );
      }
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
        body: { $ref: "saveUserReq#" },
        response: {
          200: { $ref: "userDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: SaveUserReq }>,
      reply: FastifyReply
    ) => {
      try {
        // 使用UserService创建用户
        const user = await UserService.createUser(request.body);

        console.log('user', user)

        return ResponseUtil.sendSuccess(reply, user, "创建用户成功");
      } catch (error: any) {
        fastify.log.error(error);

        // 处理业务错误
        if (error.message === `${ErrorCode.USER_ALREADY_EXISTS}`) {
          return ResponseUtil.sendError(
            reply,
            ErrorCode.USER_ALREADY_EXISTS,
            "用户已存在"
          );
        }

        return ResponseUtil.sendError(
          reply,
          ErrorCode.DATABASE_ERROR,
          "创建用户失败"
        );
      }
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
          id: Type.String({ description: "用户ID" }),
        }),
        body: { $ref: "saveUserReq#" },
        response: {
          200: { $ref: "sysUser#" },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: SaveUserReq;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = parseInt(request.params.id);

        // 验证用户ID
        if (isNaN(userId)) {
          return ResponseUtil.sendError(
            reply,
            ErrorCode.INVALID_PARAMETER,
            "用户ID无效"
          );
        }

        // 使用UserService更新用户
        const user = await UserService.updateUser(userId, request.body);

        return ResponseUtil.sendSuccess(reply, user, "更新用户成功");
      } catch (error: any) {
        fastify.log.error(error);

        // 处理业务错误
        if (error.message === `${ErrorCode.USER_NOT_FOUND}`) {
          return ResponseUtil.sendError(
            reply,
            ErrorCode.USER_NOT_FOUND,
            "用户不存在"
          );
        }

        if (error.message === `${ErrorCode.USER_ALREADY_EXISTS}`) {
          return ResponseUtil.sendError(
            reply,
            ErrorCode.USER_ALREADY_EXISTS,
            "用户已存在"
          );
        }

        return ResponseUtil.sendError(
          reply,
          ErrorCode.DATABASE_ERROR,
          "更新用户失败"
        );
      }
    }
  );
};

export default sysUser;
