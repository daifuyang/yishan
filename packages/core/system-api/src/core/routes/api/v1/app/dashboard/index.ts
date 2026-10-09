import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "@yishan/core-api/response";
import { DashboardService } from "../../../../../services/dashboard.service.js";
import { DashboardStatsRespSchema } from "../../../../../schemas/dashboard.js";
import { registerRoutePermissions as registerPermissions } from '@/route-permissions'
import type { PermissionRef } from '@yishan/core-api/permissions/catalog';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  READ: { code: 'system:dashboard:read', label: '仪表盘-读取', group: 'system' },
});

const dashboard: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  registerPermissions(...Object.values(PERMS));
  const route = createRouteRegistrar(fastify);
  route.get(
    "/stats",
    {
      access: { permission: PERMS.READ },
      preHandler: [
        fastify.authenticate,
      ],
      schema: {
        summary: "获取仪表盘统计",
        description: "获取管理员仪表盘统计数据（用户总数、部门总数、今日登录次数、在线用户数）",
        operationId: "appDashboardStats",
        tags: ["app-dashboard"],
        security: [{ bearerAuth: [] }],
        response: {
          200: DashboardStatsRespSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = await DashboardService.getStats(fastify);
      return ResponseUtil.success(reply, stats, '获取成功');
    }
  );
};

export default dashboard;
