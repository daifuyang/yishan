import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../../constants/business-codes/validation.js";
import { MenuErrorCode } from "../../../../../constants/business-codes/menu.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import { MenuListQuery, SaveMenuReq, UpdateMenuReq } from "../../../../../schemas/menu.js";
import { MenuService } from "../../../../../services/menu.service.js";
import { getMenuMessage, MenuMessageKeys } from "../../../../../constants/messages/menu.js";

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
      const message = getMenuMessage(MenuMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
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

  fastify.get(
    "/tree",
    {
      schema: {
        summary: "获取菜单树",
        description: "获取全部树形菜单",
        operationId: "getMenuTree",
        tags: ["sysMenus"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "menuTreeResp#" } },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tree = await MenuService.getMenuTree();
      {
        const message = getMenuMessage(MenuMessageKeys.TREE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, tree, message);
      }
    }
  );

  fastify.get(
    "/tree/authorized",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "获取已授权菜单树",
        description: "根据当前用户角色并集返回授权菜单树",
        operationId: "getAuthorizedMenuTree",
        tags: ["sysMenus"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "menuTreeResp#" } },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const roleIds = request.currentUser?.roleIds ?? [];
      const tree = await MenuService.getAuthorizedMenuTree(roleIds);
      {
        const message = getMenuMessage(MenuMessageKeys.TREE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, tree, message);
      }
    }
  );

  fastify.get(
    "/paths/authorized",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "获取已授权菜单路径",
        description: "根据当前用户角色并集返回允许访问的菜单路径列表",
        operationId: "getAuthorizedMenuPaths",
        tags: ["sysMenus"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "menuPathsResp#" } },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const roleIds = request.currentUser?.roleIds ?? [];
      const paths = await MenuService.getAuthorizedMenuPaths(roleIds);
      {
        const message = getMenuMessage(MenuMessageKeys.AUTH_PATHS_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, paths, message);
      }
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
      {
        const message = getMenuMessage(MenuMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, menu, message);
      }
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
      {
        const message = getMenuMessage(MenuMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, menu, message);
      }
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
      {
        const message = getMenuMessage(MenuMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, menu, message);
      }
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
      {
        const message = getMenuMessage(MenuMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, result, message);
      }
    }
  );
};

export default adminMenus;