import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../../constants/business-codes/validation.js";
import { RoleErrorCode } from "../../../../../constants/business-codes/role.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import { RoleListQuery, SaveRoleReq, UpdateRoleReq } from "../../../../../schemas/role.js";
import { RoleService } from "../../../../../services/role.service.js";

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
      return ResponseUtil.paginated(
        reply,
        result.list,
        page,
        pageSize,
        result.total,
        "获取角色列表成功"
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
          id: Type.String({ description: "角色ID" }),
        }),
        response: {
          200: { $ref: "roleDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const roleId = parseInt(request.params.id);
      if (isNaN(roleId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "角色ID不能为空");
      }
      const role = await RoleService.getRoleById(roleId);
      if (!role) {
        throw new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, "角色不存在");
      }
      return ResponseUtil.success(reply, role, "获取角色详情成功");
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
      return ResponseUtil.success(reply, role, "创建角色成功");
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
          id: Type.String({ description: "角色ID" }),
        }),
        body: { $ref: "updateRoleReq#" },
        response: {
          200: { $ref: "roleDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateRoleReq }>,
      reply: FastifyReply
    ) => {
      const roleId = parseInt(request.params.id);
      if (isNaN(roleId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "角色ID不能为空");
      }
      const role = await RoleService.updateRole(roleId, request.body);
      return ResponseUtil.success(reply, role, "更新角色成功");
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
          id: Type.String({ description: "角色ID" }),
        }),
        response: {
          200: { $ref: "roleDeleteResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const roleId = parseInt(request.params.id);
      if (isNaN(roleId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "角色ID不能为空");
      }
      const result = await RoleService.deleteRole(roleId);
      return ResponseUtil.success(reply, result, "删除角色成功");
    }
  );
};

export default adminRoles;