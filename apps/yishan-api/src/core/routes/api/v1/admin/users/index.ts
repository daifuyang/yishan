import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { createCrudHandlers, declareCrudPermissions } from '@/core/routes/admin-crud.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from '@/utils/response.js';
import { BusinessError } from '@/exceptions/business-error.js';
import {
  UserListQuery,
  CreateUserReq,
  UpdateUserReq
} from '@/core/schemas/user.js';
import { UserService } from '@/core/services/user.service.js';
import { UserErrorCode } from '@/constants/business-codes/user.js';
import { getUserMessage, UserMessageKeys } from '@/constants/messages/user.js';
const CRUD_OPTIONS = {
    resource: 'user',
    group: 'system',
    perms: {
      list: '用户管理-列表',
      create: '用户管理-创建',
      update: '用户管理-更新',
      delete: '用户管理-删除',
    },
    messages: {
      listSuccess: (lang) => getUserMessage(UserMessageKeys.LIST_SUCCESS, lang),
      createSuccess: (lang) => getUserMessage(UserMessageKeys.CREATE_SUCCESS, lang),
      updateSuccess: (lang) => getUserMessage(UserMessageKeys.UPDATE_SUCCESS, lang),
      deleteSuccess: (lang) => getUserMessage(UserMessageKeys.DELETE_SUCCESS, lang),
    },
};
const CRUD_PERMISSIONS = declareCrudPermissions(CRUD_OPTIONS.resource, CRUD_OPTIONS.group, CRUD_OPTIONS.perms);

const sysUser: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  const crud = createCrudHandlers(route, { ...CRUD_OPTIONS, predeclaredPermissions: CRUD_PERMISSIONS });
  // GET /api/v1/admin/user - 获取管理员用户列表
  crud.list({
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
    service: async (query) => {

      // 使用UserService获取管理员列表 
      return UserService.getUserList(query as UserListQuery);
    },
  });

  // GET /api/v1/admin/user/{id} - 获取用户详情
  route.get(
    "/:id",
    {
      access: { permission: crud.permissions.list },
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
  crud.create({
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
    service: async (request) => {
      // 使用UserService创建用户（带缓存写入），异常将由全局异常处理器处理
      return UserService.createUser(request.body as CreateUserReq, request.currentUser.id, fastify);
    },
  });

  // PUT /api/v1/admin/user/{id} - 更新用户
  crud.update({
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
    service: async (userId, request) => {

      // 禁用限制：不允许禁用超级管理员（ID=1）或当前登录用户自身
      const body = request.body as UpdateUserReq;
      const nextStatus = body.status;
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
      return UserService.updateUser(userId, body, request.currentUser.id, fastify);
    },
  });

  // DELETE /api/v1/admin/user/{id} - 删除用户（软删除）
  crud.delete({
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
    service: async (userId, request) => {

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
      return UserService.deleteUser(userId, fastify);
    },
  });
};

export default sysUser;
