import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../../constants/business-codes/validation.js";
import { MenuErrorCode } from "../../../../../constants/business-codes/menu.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import { MenuListQuery, SaveMenuReq, UpdateMenuReq } from "../../../../../schemas/menu.js";
import { MenuService } from "../../../../../services/menu.service.js";

const adminMenus: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/v1/admin/menus - 获取菜单列表
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取菜单列表",
        description: "分页获取菜单列表，支持关键词、状态、类型与父级过滤",
        operationId: "getMenuList",
        tags: ["sysMenus"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "menuListQuery#" },
        response: { 200: { $ref: "menuListResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: MenuListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await MenuService.getMenuList(request.query);
      return ResponseUtil.paginated(
        reply,
        result.list,
        page,
        pageSize,
        result.total,
        "获取菜单列表成功"
      );
    }
  );

  // GET /api/v1/admin/menus/{id} - 获取菜单详情
  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取菜单详情",
        description: "根据菜单ID获取菜单详情",
        operationId: "getMenuDetail",
        tags: ["sysMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "菜单ID" }) }),
        response: { 200: { $ref: "menuDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const menuId = parseInt(request.params.id);
      if (isNaN(menuId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "菜单ID不能为空");
      }
      const menu = await MenuService.getMenuById(menuId);
      if (!menu) {
        throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "菜单不存在");
      }
      return ResponseUtil.success(reply, menu, "获取菜单详情成功");
    }
  );

  // POST /api/v1/admin/menus - 创建菜单
  fastify.post(
    "/",
    {
      schema: {
        summary: "创建菜单",
        description: "创建一个新的菜单",
        operationId: "createMenu",
        tags: ["sysMenus"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveMenuReq#" },
        response: { 200: { $ref: "menuDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Body: SaveMenuReq }>,
      reply: FastifyReply
    ) => {
      const menu = await MenuService.createMenu(request.body);
      return ResponseUtil.success(reply, menu, "创建菜单成功");
    }
  );

  // PUT /api/v1/admin/menus/{id} - 更新菜单
  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新菜单",
        description: "根据菜单ID更新菜单信息",
        operationId: "updateMenu",
        tags: ["sysMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "菜单ID" }) }),
        body: { $ref: "updateMenuReq#" },
        response: { 200: { $ref: "menuDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateMenuReq }>,
      reply: FastifyReply
    ) => {
      const menuId = parseInt(request.params.id);
      if (isNaN(menuId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "菜单ID不能为空");
      }
      const menu = await MenuService.updateMenu(menuId, request.body);
      return ResponseUtil.success(reply, menu, "更新菜单成功");
    }
  );

  // DELETE /api/v1/admin/menus/{id} - 删除菜单（软删除）
  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除菜单",
        description: "根据菜单ID进行软删除，存在子菜单或已绑定角色禁止删除",
        operationId: "deleteMenu",
        tags: ["sysMenus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "菜单ID" }) }),
        response: { 200: { $ref: "menuDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const menuId = parseInt(request.params.id);
      if (isNaN(menuId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "菜单ID不能为空");
      }
      const result = await MenuService.deleteMenu(menuId);
      return ResponseUtil.success(reply, result, "删除菜单成功");
    }
  );
};

export default adminMenus;