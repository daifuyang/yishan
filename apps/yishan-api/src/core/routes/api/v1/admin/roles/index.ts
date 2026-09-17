import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { createCrudHandlers, declareCrudPermissions } from '@/core/routes/admin-crud.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "@/utils/response.js";
import { RoleErrorCode } from "@/constants/business-codes/role.js";
import { BusinessError } from "@/exceptions/business-error.js";
import { RoleListQuery, SaveRoleReq, UpdateRoleReq } from "@/core/schemas/role.js";
import { RoleService } from "@/core/services/role.service.js";
import { getRoleMessage, RoleMessageKeys } from "@/constants/messages/role.js";
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js';

const GRANT_PERMISSION: PermissionRef = {
  code: 'system:role:grant',
  label: '角色管理-授权',
  group: 'system',
};
registerPermissions(GRANT_PERMISSION);
const CRUD_OPTIONS = {
    resource: 'role',
    group: 'system',
    perms: {
      list: '角色管理-列表',
      create: '角色管理-创建',
      update: '角色管理-更新',
      delete: '角色管理-删除',
    },
    messages: {
      listSuccess: (lang) => getRoleMessage(RoleMessageKeys.LIST_SUCCESS, lang),
      createSuccess: (lang) => getRoleMessage(RoleMessageKeys.CREATE_SUCCESS, lang),
      updateSuccess: (lang) => getRoleMessage(RoleMessageKeys.UPDATE_SUCCESS, lang),
      deleteSuccess: (lang) => getRoleMessage(RoleMessageKeys.DELETE_SUCCESS, lang),
    },
};
const CRUD_PERMISSIONS = declareCrudPermissions(CRUD_OPTIONS.resource, CRUD_OPTIONS.group, CRUD_OPTIONS.perms);

const adminRoles: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  const crud = createCrudHandlers(route, { ...CRUD_OPTIONS, predeclaredPermissions: CRUD_PERMISSIONS });
  // GET /api/v1/admin/roles - 获取角色列表
  crud.list({
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
    service: (query) => RoleService.getRoleList(query as RoleListQuery),
  });

  // GET /api/v1/admin/roles/{id} - 获取角色详情
  route.get(
    "/:id",
    {
      access: { permission: crud.permissions.list },
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
  route.post(
    "/",
    {
      access: { permission: crud.permissions.create },
      preHandler: [
        fastify.requirePermission(GRANT_PERMISSION),
      ] as any,
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
      const role = await RoleService.createRole(request.body, request.currentUser.id);
      {
        const message = getRoleMessage(RoleMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, role, message);
      }
    }
  );

  // PUT /api/v1/admin/roles/{id} - 更新角色
  route.put(
    "/:id",
    {
      access: { permission: crud.permissions.update },
      preHandler: [
        fastify.requirePermission(GRANT_PERMISSION),
      ] as any,
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
      const role = await RoleService.updateRole(roleId, request.body, request.currentUser.id);
      {
        const message = getRoleMessage(RoleMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, role, message);
      }
    }
  );

  // DELETE /api/v1/admin/roles/{id} - 删除角色（软删除）
  crud.delete({
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
    service: (id) => RoleService.deleteRole(id),
  });
}; 

export default adminRoles;
