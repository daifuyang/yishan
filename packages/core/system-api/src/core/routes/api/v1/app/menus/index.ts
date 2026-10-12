import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "@yishan/core-api/response";
import { AppMenuService } from "../../../../../services/app-menu.service.js";
import { registerRoutePermissions as registerPermissions } from '@/route-permissions'
import type { PermissionRef } from '@yishan/core-api/permissions/catalog';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  TREE_AUTHORIZED:   { code: 'app:menu:authorized-tree',  label: '移动端-已授权菜单树',     group: 'app' },
  FLATTEN_AUTHORIZED:{ code: 'app:menu:authorized-flat',   label: '移动端-已授权菜单扁平',  group: 'app' },
});

/**
 * 移动端菜单路由 - /api/v1/app/menus
 */
const menus: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  registerPermissions(...Object.values(PERMS));
  const route = createRouteRegistrar(fastify);
  // GET /api/v1/app/menus/authorized - 当前用户已授权菜单（树形）
  route.get(
    "/authorized",
    {
      access: { permission: PERMS.TREE_AUTHORIZED },
      schema: {
        summary: "获取已授权菜单树",
        description: "返回当前用户可见的工作台分组与应用入口（独立于 Web 菜单），已按角色授权、模块启用状态过滤",
        operationId: "appGetAuthorizedMenuTree",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "appMenuTreeResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const roleIds = request.currentUser?.roleIds ?? [];
      const tree = await AppMenuService.getAuthorizedTree(roleIds, fastify.moduleLoader);
      return ResponseUtil.success(reply, tree, "获取菜单树成功");
    }
  );

  // GET /api/v1/app/menus/flatten - 当前用户已授权菜单（扁平）
  route.get(
    "/flatten",
    {
      access: { permission: PERMS.FLATTEN_AUTHORIZED },
      schema: {
        summary: "获取已授权菜单（扁平）",
        description: "当前用户可见的工作台节点扁平列表（分组在前，入口随后，保持树的先序顺序）",
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
                items: { $ref: "appMenuNode#" },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const roleIds = request.currentUser?.roleIds ?? [];
      const tree = await AppMenuService.getAuthorizedTree(roleIds, fastify.moduleLoader);
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
