import { createRouteRegistrar } from '../../../../route-registrar.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { MenuService } from "../../../../../services/menu.service.js";

/**
 * 移动端菜单路由 - /api/v1/app/menus
 */
const menus: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  // GET /api/v1/app/menus/authorized - 当前用户已授权菜单（树形）
  route.get(
    "/authorized",
    {
      access: 'authenticated',
      schema: {
        summary: "获取已授权菜单树",
        description: "根据当前用户角色并集返回授权菜单树，移动端用于渲染应用 Tab",
        operationId: "appGetAuthorizedMenuTree",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "menuTreeResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const roleIds = request.currentUser?.roleIds ?? [];
      const tree = await MenuService.getAuthorizedMenuTree(roleIds);
      return ResponseUtil.success(reply, tree, "获取菜单树成功");
    }
  );

  // GET /api/v1/app/menus/flatten - 当前用户已授权菜单（扁平）
  route.get(
    "/flatten",
    {
      access: 'authenticated',
      schema: {
        summary: "获取已授权菜单（扁平）",
        description: "根据当前用户角色并集返回授权菜单扁平列表，包含完整字段（icon, path, perm 等）",
        operationId: "appGetAuthorizedMenuFlat",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: {
                type: "array",
                items: { $ref: "menuTreeNode#" },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const roleIds = request.currentUser?.roleIds ?? [];
      const tree = await MenuService.getAuthorizedMenuTree(roleIds);
      // 拍平树
      const flatten: any[] = [];
      const walk = (nodes: any[]) => {
        for (const n of nodes) {
          flatten.push({ ...n, children: undefined });
          if (n.children && n.children.length > 0) walk(n.children);
        }
      };
      walk(tree);
      return ResponseUtil.success(reply, flatten, "获取菜单扁平列表成功");
    }
  );
};

export default menus;
