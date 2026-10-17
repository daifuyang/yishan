import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import { createCrudHandlers, declareCrudPermissions } from '@/core/routes/admin-crud.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from '@yishan/core-api/response';
import { BusinessError } from '@yishan/core-api/errors';
import {
  UserListQuery,
  CreateUserReq,
  UpdateUserReq,
  UserCreateOptionsQuery,
} from '@/core/schemas/user.js';
import { UserService } from '@/core/services/user.service.js';
import { UserCreationFormService } from '@/core/services/user-creation-form.service.js';
import type { UserCreationSubject } from '@/core/services/user-creation-policy.js';
import { UserErrorCode } from '@yishan/core-api/business-codes/user';
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

  // 只读元数据端点：原生表单与 AI 助手共用同一份字段/候选来源。
  // 两者都要求 system:user:create —— 能建号才有资格问「可以建什么样」；
  // 但**出现在候选里不等于被授权**，最终提交仍会重新走 validateUserCreation。
  //
  // 路径用固定的 `create-form` / `create-options`，且注册在 `/:id` 之前；
  // test/user-creation-routes.test.ts 断言它们不会被参数路由吞掉。
  route.get(
    "/create-form",
    {
      access: { permission: crud.permissions.create },
      schema: {
        summary: "获取新增用户表单定义",
        description: "返回真实创建 Schema 派生的字段名/标签/必填/约束/敏感标记与选择器标识，不含可执行渲染代码",
        operationId: "getUserCreateForm",
        tags: ["sysUsers"],
        querystring: { type: "object", additionalProperties: false, properties: {} },
        response: { 200: { $ref: "userCreateFormResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return ResponseUtil.success(reply, UserCreationFormService.getCreateForm());
    }
  );

  route.get(
    "/create-options",
    {
      access: { permission: crud.permissions.create },
      schema: {
        summary: "获取新增用户候选选项",
        description: "返回按当前授权范围过滤后的部门树，以及按候选 deptIds 重算后的可授予角色",
        operationId: "getUserCreateOptions",
        tags: ["sysUsers"],
        querystring: { $ref: "userCreateOptionsQuery#" },
        response: { 200: { $ref: "userCreateOptionsResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: UserCreateOptionsQuery }>, reply: FastifyReply) => {
      // 操作者身份完全来自服务端：actorId 取自已认证用户，tokenScope 取自本次 PAT。
      // 不接受请求体里的任何身份/权限声明。
      const subject: UserCreationSubject = {
        actorId: request.currentUser.id,
        tokenScope: (request as FastifyRequest & { tokenScope?: string[] }).tokenScope,
      };
      const data = await UserCreationFormService.listCandidates(subject, request.query ?? {});
      return ResponseUtil.success(reply, data);
    }
  );

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
      // 删除限制（系统管理员 / 当前登录用户）由 UserService.deleteUser 统一实施，
      // 此处只提供操作者身份，避免绕过 HTTP 的调用方失去这层保护。
      return UserService.deleteUser(userId, request.currentUser?.id, fastify);
    },
  });
};

export default sysUser;
