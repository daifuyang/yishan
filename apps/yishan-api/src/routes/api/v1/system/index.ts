/**
 * 系统管理路由
 * 用于系统维护和定时任务
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "../../../../utils/response.js";
import { BusinessError } from "../../../../exceptions/business-error.js";
import { SystemManageErrorCode } from "../../../../constants/business-codes/system.js";
import { SystemService } from "../../../../services/system.service.js";

const system: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  /**
   * 验证定时任务令牌
   */
  const validateCronToken = async (token: string): Promise<boolean> => {
    // 从环境变量获取预配置的定时任务令牌
    const cronToken = process.env.CRON_TOKEN || 'default-cron-token-2024';
    return token === cronToken;
  };

  /**
   * 清理过期token
   * POST /api/v1/system/cleanup-tokens
   */
  fastify.post(
    "/cleanup-tokens",
    {
      schema: {
        summary: "清理过期token",
        description: "定时任务接口，用于清理过期的用户token，需要特殊的定时任务令牌进行鉴权",
        operationId: "cleanupTokens",
        tags: ["system"],
        body: { $ref: "cleanupTokensReq#" },
        response: {
          200: { $ref: "cleanupTokensResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ 
        Body: { 
          cron_token: string; 
          days_to_keep?: number;
        } 
      }>,
      reply: FastifyReply
    ) => {
      const { cron_token, days_to_keep = 30 } = request.body;
      
      // 验证定时任务令牌
      const isValidToken = await validateCronToken(cron_token);
      if (!isValidToken) {
        throw new BusinessError(SystemManageErrorCode.INVALID_CRON_TOKEN, "无效的定时任务令牌");
      }

      // 验证参数范围
      if (days_to_keep < 1 || days_to_keep > 365) {
        throw new BusinessError(SystemManageErrorCode.INVALID_CRON_TOKEN, "保留天数必须在1-365天之间");
      }

      // 执行清理任务
      const result = await SystemService.cleanupExpiredTokens(days_to_keep);
      
      return ResponseUtil.success(reply, result, "过期token清理成功");
    }
  );

  /**
   * 获取token统计信息
   * GET /api/v1/system/token-stats
   */
  fastify.get(
    "/token-stats",
    {
      schema: {
        summary: "获取token统计信息",
        description: "获取系统中token的统计信息，包括总数、活跃数、过期数等",
        operationId: "getTokenStats",
        tags: ["system"],
        response: {
          200: { $ref: "tokenStatsResp#" },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      // 获取token统计信息
      const stats = await SystemService.getTokenStats();
      
      return ResponseUtil.success(reply, stats, "获取token统计信息成功");
    }
  );
};

export default system;