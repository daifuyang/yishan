import { prismaManager } from "../../utils/prisma.js";
import { DashboardStats } from "../schemas/dashboard.js";

const DASHBOARD_STATS_CACHE_KEY = 'dashboard:stats';
const DASHBOARD_STATS_CACHE_TTL = 30;

export class DashboardService {
  private static prisma = prismaManager.getClient();

  static async getStats(fastify?: any): Promise<DashboardStats> {
    if (fastify?.redis) {
      try {
        const cached = await fastify.redis.get(DASHBOARD_STATS_CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        fastify.log.warn(`Redis cache get failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [userTotal, deptTotal, todayLogin, onlineUsers] = await Promise.all([
      this.prisma.sysUser.count({
        where: { deletedAt: null },
      }),
      this.prisma.sysDept.count({
        where: { deletedAt: null },
      }),
      this.prisma.sysLoginLog.count({
        where: {
          createdAt: { gte: today },
          deletedAt: null,
        },
      }),
      this.prisma.sysLoginLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: fiveMinutesAgo },
          userId: { not: null },
          deletedAt: null,
        },
      }),
    ]);

    const stats: DashboardStats = {
      userTotal,
      deptTotal,
      todayLogin,
      online: onlineUsers.length,
    };

    if (fastify?.redis) {
      try {
        await fastify.redis.setex(
          DASHBOARD_STATS_CACHE_KEY,
          DASHBOARD_STATS_CACHE_TTL,
          JSON.stringify(stats)
        );
      } catch (error) {
        fastify.log.warn(`Redis cache set failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return stats;
  }
}
