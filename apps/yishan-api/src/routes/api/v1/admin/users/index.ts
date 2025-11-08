import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../../constants/business-codes/validation.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import {
  UserListQuery,
  SaveUserReq,
  UpdateUserReq
} from "../../../../../schemas/user.js";
import { UserService } from "../../../../../services/user.service.js";
import { UserErrorCode } from "../../../../../constants/business-codes/user.js";
import { CACHE_CONFIG } from "../../../../../config/index.js";

// 用户详情缓存：键格式集中定义（TTL 使用配置中心）
const getUserDetailCacheKey = (userId: number) => `user:detail:${userId}`;

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

      return ResponseUtil.paginated(
        reply,
        result.list,
        page,
        pageSize,
        result.total,
        "获取用户列表成功"
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
          id: Type.String({ description: "用户ID" }),
        }),
        response: {
          200: { $ref: "userDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const userId = parseInt(request.params.id);
      if (isNaN(userId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "用户ID不能为空");
      }
      const CACHE_KEY = getUserDetailCacheKey(userId);

      // 优先尝试缓存
      if (fastify.redis) {
        try {
          const cached = await fastify.redis.get(CACHE_KEY);
          if (cached) {
            const data = JSON.parse(cached);
            return ResponseUtil.success(reply, data, "获取用户详情成功");
          }
        } catch (err) {
          fastify.log.warn(`读取用户详情缓存失败: ${(err as Error).message}`);
        }
      }

      const user = await UserService.getUserById(userId);
      if (!user) {
        throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在或已删除");
      }

      // 写入缓存
      if (fastify.redis) {
        try {
          await fastify.redis.setex(CACHE_KEY, CACHE_CONFIG.userDetailTTLSeconds, JSON.stringify(user));
        } catch (err) {
          fastify.log.warn(`写入用户详情缓存失败: ${(err as Error).message}`);
        }
      }

      return ResponseUtil.success(reply, user, "获取用户详情成功");
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
        body: { $ref: "updateUserReq#" },
        response: {
          200: { $ref: "userDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: SaveUserReq }>,
      reply: FastifyReply
    ) => {
      // 使用UserService创建用户，异常将由全局异常处理器处理
      const user = await UserService.createUser(request.body);

      // 新增后写入详情缓存
      if (fastify.redis && user && typeof user.id === "number") {
        try {
          const cacheKey = getUserDetailCacheKey(user.id);
          await fastify.redis.setex(cacheKey, CACHE_CONFIG.userDetailTTLSeconds, JSON.stringify(user));
        } catch (err) {
          fastify.log.warn(`创建用户后写入详情缓存失败: ${(err as Error).message}`);
        }
      }
      return ResponseUtil.success(reply, user, "创建用户成功");
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
        body: { $ref: "updateUserReq#" },
        response: {
          200: { $ref: "userDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateUserReq;
      }>,
      reply: FastifyReply
    ) => {
      const userId = parseInt(request.params.id);

      // 验证用户ID
      if (isNaN(userId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "用户ID不能为空");
      }

      // 使用UserService更新用户，异常将由全局异常处理器处理
      const user = await UserService.updateUser(userId, request.body);

      // 更新后同步刷新详情缓存
      if (fastify.redis && user && typeof user.id === "number") {
        try {
          const cacheKey = getUserDetailCacheKey(user.id);
          await fastify.redis.setex(cacheKey, CACHE_CONFIG.userDetailTTLSeconds, JSON.stringify(user));
        } catch (err) {
          fastify.log.warn(`更新用户后刷新详情缓存失败: ${(err as Error).message}`);
        }
      }

      return ResponseUtil.success(reply, user, "更新用户成功");
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
          id: Type.String({ description: "用户ID" }),
        }),
        response: {
          200: { $ref: "userDeleteResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const userId = parseInt(request.params.id);
      if (isNaN(userId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "用户ID不能为空");
      }

      const result = await UserService.deleteUser(userId);

      // 删除缓存
      if (fastify.redis) {
        const CACHE_KEY = getUserDetailCacheKey(userId);
        try {
          await fastify.redis.del(CACHE_KEY);
        } catch (err) {
          fastify.log.warn(`删除用户详情缓存失败: ${(err as Error).message}`);
        }
      }

      return ResponseUtil.success(reply, result, "删除用户成功");
    }
  );
};

export default sysUser;
