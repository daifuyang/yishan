import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { RoleErrorCode } from "../../../../../constants/business-codes/role.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import { RoleListQuery, SaveRoleReq, UpdateRoleReq } from "../../../../../schemas/role.js";
import { RoleService } from "../../../../../services/role.service.js";
import { getRoleMessage, RoleMessageKeys } from "../../../../../constants/messages/role.js";

const adminRoles: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/v1/admin/roles - 获取角色列表
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取角色列表",
        description: "分页获取系统角色列表，支持关键词搜索和状态筛选",
        operationId: "getRoleList",
        tags: ["sysRoles"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "roleListQuery#" },
        response: {
          200: { $ref: "roleListResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: RoleListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await RoleService.getRoleList(request.query);
      const message = getRoleMessage(RoleMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
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

  // GET /api/v1/admin/roles/{id} - 获取角色详情
  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取角色详情",
        description: "根据角色ID获取角色详情",
        operationId: "getRoleDetail",
        tags: ["sysRoles"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.Integer({ description: "角色ID", minimum: 1 }),
        }),
        response: {
          200: { $ref: "roleDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number } }>,
      reply: FastifyReply
    ) => {
      const roleId = request.params.id;
      const role = await RoleService.getRoleById(roleId);
      if (!role) {
        throw new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, "角色不存在");
      }
      {
        const message = getRoleMessage(RoleMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, role, message);
      }
    }
  );

  // POST /api/v1/admin/roles - 创建角色
  fastify.post(
    "/",
    {
      schema: {
        summary: "创建角色",
        description: "创建一个新的系统角色",
        operationId: "createRole",
        tags: ["sysRoles"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveRoleReq#" },
        response: {
          200: { $ref: "roleDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: SaveRoleReq }>,
      reply: FastifyReply
    ) => {
      const role = await RoleService.createRole(request.body);
      {
        const message = getRoleMessage(RoleMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, role, message);
      }
    }
  );

  // PUT /api/v1/admin/roles/{id} - 更新角色
  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新角色",
        description: "根据角色ID更新角色信息",
        operationId: "updateRole",
        tags: ["sysRoles"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.Integer({ description: "角色ID", minimum: 1 }),
        }),
        body: { $ref: "updateRoleReq#" },
        response: {
          200: { $ref: "roleDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number }; Body: UpdateRoleReq }>,
      reply: FastifyReply
    ) => {
      const roleId = request.params.id;
      const role = await RoleService.updateRole(roleId, request.body);
      {
        const message = getRoleMessage(RoleMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, role, message);
      }
    }
  );

  // DELETE /api/v1/admin/roles/{id} - 删除角色（软删除）
  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除角色",
        description: "根据角色ID进行软删除",
        operationId: "deleteRole",
        tags: ["sysRoles"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.Integer({ description: "角色ID", minimum: 1 }),
        }),
        response: {
          200: { $ref: "roleDeleteResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number } }>,
      reply: FastifyReply
    ) => {
      const roleId = request.params.id;
      const result = await RoleService.deleteRole(roleId);
      {
        const message = getRoleMessage(RoleMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, result, message);
      }
    }
  );
}; 

export default adminRoles;