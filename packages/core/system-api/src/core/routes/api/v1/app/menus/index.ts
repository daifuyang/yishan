import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "@yishan/core-api/response";
import { AppMenuService } from "../../../../../services/app-menu.service.js";
import { AppHomeService } from "../../../../../services/app-home.service.js";
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

  // 首页常用应用：只作用于当前用户；与工作台树同一权限，能看到工作台即可管理自己的常用应用
  const currentUser = (request: FastifyRequest) => ({
    userId: request.currentUser!.id,
    roleIds: request.currentUser?.roleIds ?? [],
  });

  // GET /api/v1/app/menus/home - 首页常用应用排序
  route.get(
    "/home",
    {
      access: { permission: PERMS.TREE_AUTHORIZED },
      schema: {
        summary: "获取首页常用应用",
        description: "pinned 为用户固定的入口（用户顺序），ranked 为其余已授权入口按使用习惯排序；均为工作台入口 ID",
        operationId: "appGetHomeApps",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "appHomeAppsResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, roleIds } = currentUser(request);
      const home = await AppHomeService.getHome(userId, roleIds, fastify.moduleLoader);
      return ResponseUtil.success(reply, home, "获取常用应用成功");
    }
  );

  // PUT /api/v1/app/menus/pins - 保存固定的常用应用（整体覆盖）
  route.put(
    "/pins",
    {
      access: { permission: PERMS.TREE_AUTHORIZED },
      schema: {
        summary: "保存首页固定应用",
        description: "按数组顺序整体覆盖当前用户固定的入口；不可用的入口被丢弃，最多 8 个",
        operationId: "appSaveHomePins",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveAppHomePinsReq#" },
        response: { 200: { $ref: "appHomeAppsResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, roleIds } = currentUser(request);
      const { menuIds } = request.body as { menuIds: number[] };
      const home = await AppHomeService.savePins(userId, roleIds, menuIds, fastify.moduleLoader);
      return ResponseUtil.success(reply, home, "保存成功");
    }
  );

  // POST /api/v1/app/menus/usage - 记录一次打开，用于首页推荐
  route.post(
    "/usage",
    {
      access: { permission: PERMS.TREE_AUTHORIZED },
      schema: {
        summary: "记录应用打开",
        description: "累加当前用户对某个工作台入口的打开次数；入口不可用时不记录",
        operationId: "appReportAppUsage",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "reportAppUsageReq#" },
        response: { 200: { $ref: "reportAppUsageResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, roleIds } = currentUser(request);
      const { menuId } = request.body as { menuId: number };
      const result = await AppHomeService.recordUsage(userId, roleIds, menuId, fastify.moduleLoader);
      return ResponseUtil.success(reply, result, "已记录");
    }
  );
};

export default menus;
