import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import { createCrudHandlers, declareCrudPermissions } from '@/core/routes/admin-crud.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from '@yishan/core-api/response';
import { ValidationErrorCode } from '@yishan/core-api/business-codes/validation';
import { MenuErrorCode } from '@yishan/core-api/business-codes/menu';
import { BusinessError } from '@yishan/core-api/errors';
import type { ReorderAppMenuReq, SaveAppMenuReq, UpdateAppMenuReq } from '@/core/schemas/app-menu.js';
import { AppMenuService } from '@/core/services/app-menu.service.js';

const parseAppMenuId = (rawId: string) => {
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "工作台菜单ID不能为空");
  }
  return id;
};

const CRUD_OPTIONS = {
  resource: 'app-menu',
  group: 'system',
  perms: {
    list: '工作台管理-列表',
    create: '工作台管理-创建',
    update: '工作台管理-更新',
    delete: '工作台管理-删除',
  },
  messages: {
    createSuccess: () => '创建工作台菜单成功',
    updateSuccess: () => '更新工作台菜单成功',
    deleteSuccess: () => '删除工作台菜单成功',
  },
};
const CRUD_PERMISSIONS = declareCrudPermissions(CRUD_OPTIONS.resource, CRUD_OPTIONS.group, CRUD_OPTIONS.perms);

const idParams = Type.Object({ id: Type.String({ description: "工作台菜单ID" }) });

const adminAppMenus: FastifyPluginAsync = async (fastify): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  const crud = createCrudHandlers(route, { ...CRUD_OPTIONS, predeclaredPermissions: CRUD_PERMISSIONS });

  // GET /api/v1/admin/app-menus/tree - 工作台菜单树（含禁用节点）
  route.get(
    "/tree",
    {
      access: { permission: crud.permissions.list },
      schema: {
        summary: "获取工作台菜单树",
        description: "获取全部工作台分组与应用入口，同级按 sortOrder 排序",
        operationId: "getAppMenuTree",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "appMenuTreeResp#" } },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const tree = await AppMenuService.getTree();
      return ResponseUtil.success(reply, tree, "获取工作台菜单成功");
    }
  );

  // GET /api/v1/admin/app-menus/:id
  route.get(
    "/:id",
    {
      access: { permission: crud.permissions.list },
      schema: {
        summary: "获取工作台菜单详情",
        description: "根据ID获取工作台菜单详情",
        operationId: "getAppMenuDetail",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        params: idParams,
        response: { 200: { $ref: "appMenuDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const menu = await AppMenuService.getById(parseAppMenuId(request.params.id));
      if (!menu) throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "工作台菜单不存在");
      return ResponseUtil.success(reply, menu, "获取工作台菜单详情成功");
    }
  );

  // POST /api/v1/admin/app-menus
  crud.create({
    schema: {
      summary: "创建工作台菜单",
      description: "创建工作台分组或应用入口",
      operationId: "createAppMenu",
      tags: ["sysAppMenus"],
      security: [{ bearerAuth: [] }],
      body: { $ref: "saveAppMenuReq#" },
      response: { 200: { $ref: "appMenuDetailResp#" } },
    },
    service: (request) => AppMenuService.create(request.body as SaveAppMenuReq, request.currentUser?.id),
  });

  // POST /api/v1/admin/app-menus/reorder - 同级重排
  route.post(
    "/reorder",
    {
      access: { permission: crud.permissions.update },
      schema: {
        summary: "工作台菜单同级排序",
        description: "按 orderedIds 的顺序重写该层级全部节点的 sortOrder（10、20、30…）",
        operationId: "reorderAppMenus",
        tags: ["sysAppMenus"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "reorderAppMenuReq#" },
        response: { 200: { $ref: "appMenuReorderResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await AppMenuService.reorder(request.body as ReorderAppMenuReq);
      return ResponseUtil.success(reply, result, "排序成功");
    }
  );

  // PUT /api/v1/admin/app-menus/:id
  crud.update({
    schema: {
      summary: "更新工作台菜单",
      description: "根据ID更新工作台菜单",
      operationId: "updateAppMenu",
      tags: ["sysAppMenus"],
      security: [{ bearerAuth: [] }],
      params: idParams,
      body: { $ref: "updateAppMenuReq#" },
      response: { 200: { $ref: "appMenuDetailResp#" } },
    },
    parseId: parseAppMenuId,
    service: (id, request) => AppMenuService.update(id, request.body as UpdateAppMenuReq, request.currentUser?.id),
  });

  // DELETE /api/v1/admin/app-menus/:id
  crud.delete({
    schema: {
      summary: "删除工作台菜单",
      description: "软删除；分组下存在应用入口时禁止，删除时同步清理角色授权",
      operationId: "deleteAppMenu",
      tags: ["sysAppMenus"],
      security: [{ bearerAuth: [] }],
      params: idParams,
      response: { 200: { $ref: "appMenuDeleteResp#" } },
    },
    parseId: parseAppMenuId,
    service: (id) => AppMenuService.delete(id),
  });
};

export default adminAppMenus;
