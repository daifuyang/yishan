/**
 * 系统管理服务 - 用于系统维护和定时任务
 */

import { UserTokenRepository } from "../repositories/user-token.repository.js";
import { SystemManageErrorCode } from "../../constants/business-codes/system.js";
import { BusinessError } from "../../exceptions/business-error.js";

export class SystemService {
  /**
   * 清理过期的token
   */
  static async cleanupExpiredTokens(daysToKeep: number = 30): Promise<{
    deletedCount: number;
    revokedCount: number;
    message: string;
  }> {
    try {
      const revokedResult = await UserTokenRepository.cleanupExpiredTokens();
      const deletedResult = await UserTokenRepository.deleteExpiredTokens(daysToKeep);
      return {
        deletedCount: deletedResult.count,
        revokedCount: revokedResult.count,
        message: `成功清理${deletedResult.count}个过期token，撤销${revokedResult.count}个过期token`,
      };
    } catch (error) {
      throw new BusinessError(
        SystemManageErrorCode.CRON_JOB_FAILED,
        `清理过期token失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  /**
   * 获取token统计信息
   */
  static async getTokenStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    revokedTokens: number;
  }> {
    try {
      return await UserTokenRepository.getGlobalTokenStats();
    } catch (error) {
      throw new BusinessError(
        SystemManageErrorCode.CRON_JOB_FAILED,
        `获取token统计信息失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }
}