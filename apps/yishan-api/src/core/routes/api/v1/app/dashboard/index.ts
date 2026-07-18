import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { DashboardService } from "../../../../../services/dashboard.service.js";
import { DashboardStatsRespSchema } from "../../../../../schemas/dashboard.js";
import { PERMISSION_CODES } from "../../../../../../constants/permission-codes.js";

const dashboard: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/stats",
    {
      preHandler: [
        fastify.authenticate,
        // Section 1 — 新增 Admin route 必须绑定 permission code。这里使用
        // 系统级 `system:dashboard:read` 在核心权限目录中登记；super_admin 自动旁路。
        fastify.requirePermission(PERMISSION_CODES.SYSTEM_DASHBOARD_READ),
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
