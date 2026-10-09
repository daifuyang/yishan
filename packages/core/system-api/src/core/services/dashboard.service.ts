import { currentSystemRuntime } from '@/runtime'
import type { FastifyInstance } from "fastify";
import { UserRepository } from "../repositories/user.repository.js";
import { DeptRepository } from "../repositories/dept.repository.js";
import { LoginLogRepository } from "../repositories/login-log.repository.js";
import { DashboardStats } from "../schemas/dashboard.js";

const dashboardCacheKey = () => `${currentSystemRuntime().config.cacheNamespace}:dashboard:stats`;
const DASHBOARD_STATS_CACHE_TTL = 30;

export class DashboardService {
  static async getStats(fastify?: FastifyInstance): Promise<DashboardStats> {
    if (fastify?.redis) {
      try {
        const cached = await fastify.redis.get(dashboardCacheKey());
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

    const [userTotal, deptTotal, todayLogin, online] = await Promise.all([
      UserRepository.count({}),
      DeptRepository.count({}),
      LoginLogRepository.count({ startTime: today }),
      LoginLogRepository.countDistinctUsersInWindow(fiveMinutesAgo),
    ]);

    const stats: DashboardStats = {
      userTotal,
      deptTotal,
      todayLogin,
      online,
    };

    if (fastify?.redis) {
      try {
        await fastify.redis.setex(
          dashboardCacheKey(),
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