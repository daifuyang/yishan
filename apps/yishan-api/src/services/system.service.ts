/**
 * 系统管理服务 - 用于系统维护和定时任务
 */

import { SysUserTokenModel } from "../models/user-token.model.js";
import { SystemManageErrorCode } from "../constants/business-codes/system.js";
import { BusinessError } from "../exceptions/business-error.js";
import { prisma } from "../utils/prisma.js";

export class SystemService {
  /**
   * 清理过期的token
   * @param daysToKeep 保留天数，默认30天
   * @returns 清理结果统计
   */
  static async cleanupExpiredTokens(daysToKeep: number = 30): Promise<{
    deletedCount: number;
    revokedCount: number;
    message: string;
  }> {
    try {
      // 1. 首先撤销过期的token（软删除）
      const revokedResult = await SysUserTokenModel.cleanupExpiredTokens();
      
      // 2. 然后物理删除指定天数前的过期token
      const deletedResult = await SysUserTokenModel.deleteExpiredTokens(daysToKeep);
      
      return {
        deletedCount: deletedResult.count,
        revokedCount: revokedResult.count,
        message: `成功清理${deletedResult.count}个过期token，撤销${revokedResult.count}个过期token`
      };
    } catch (error) {
      throw new BusinessError(
        SystemManageErrorCode.CRON_JOB_FAILED,
        `清理过期token失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 获取token统计信息
   * @returns token统计信息
   */
  static async getTokenStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    revokedTokens: number;
  }> {
    try {
      const now = new Date();
      
      const [totalTokens, activeTokens, expiredTokens, revokedTokens] = await Promise.all([
        // 总token数
        prisma.sysUserToken.count({
          where: { deletedAt: null }
        }),
        // 活跃token数
        prisma.sysUserToken.count({
          where: {
            deletedAt: null,
            isRevoked: false,
            accessTokenExpiresAt: { gt: now }
          }
        }),
        // 过期token数
        prisma.sysUserToken.count({
          where: {
            deletedAt: null,
            isRevoked: false,
            accessTokenExpiresAt: { lt: now }
          }
        }),
        // 已撤销token数
        prisma.sysUserToken.count({
          where: {
            deletedAt: null,
            isRevoked: true
          }
        })
      ]);
      
      return {
        totalTokens,
        activeTokens,
        expiredTokens,
        revokedTokens
      };
    } catch (error) {
      throw new BusinessError(
        SystemManageErrorCode.CRON_JOB_FAILED,
        `获取token统计信息失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }
}