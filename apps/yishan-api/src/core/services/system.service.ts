/**
 * 系统管理服务 - 用于系统维护和定时任务
 */

import { UserTokenRepository } from "../repositories/user-token.repository.js";
import { ApiTokenRepository } from "../repositories/api-token.repository.js";
import { SystemManageErrorCode } from "../../constants/business-codes/system.js";
import { BusinessError } from "../../exceptions/business-error.js";

/**
 * 单类 token 统计口径（total/active/expired/revoked 四数互斥且 = total）。
 * 同时覆盖：
 *   - PAT（sys_api_token，ApiTokenRepository.getGlobalApiTokenStats）
 *   - JWT access token（sys_user_token，UserTokenRepository.getGlobalTokenStats）
 */
export type TokenCategoryStats = {
  total: number;
  active: number;
  expired: number;
  revoked: number;
};

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
   * 获取 token 统计信息。
   *
   * 返回结构按 token 类型拆开，避免历史版本里 `active/expired/revoked` 三个计数
   * 混在一起导致歧义（旧版本只把 `revokedTokens` 算 user_token 的，但其它三个
   * 算的是混合体）。N6（FIX-api-validation-2026-07-24）落地后：
   *   - `apiTokens`   → sys_api_token（PAT，personal access token）
   *   - `userTokens`  → sys_user_token（JWT access/refresh token）
   * 两边的口径都是 `total/active/expired/revoked`。
   *
   * 为方便旧客户端平滑过渡，response 同时保留扁平字段
   * `totalTokens/activeTokens/expiredTokens/revokedTokens`，
   * 取的是 `userTokens`（更接近旧版本的实际口径）；
   * 新代码请按 `apiTokens` / `userTokens` 分别取值。
   */
  static async getTokenStats(): Promise<{
    apiTokens: TokenCategoryStats;
    userTokens: TokenCategoryStats;
    /** @deprecated 自 N6 拆分后口径与 userTokens 不一致的概率较高，请改用 userTokens */
    totalTokens: number;
    /** @deprecated 自 N6 拆分后口径与 userTokens 不一致的概率较高，请改用 userTokens */
    activeTokens: number;
    /** @deprecated 自 N6 拆分后口径与 userTokens 不一致的概率较高，请改用 userTokens */
    expiredTokens: number;
    /** @deprecated 自 N6 拆分后口径与 userTokens 不一致的概率较高，请改用 userTokens */
    revokedTokens: number;
  }> {
    try {
      const [apiTokens, userTokens] = await Promise.all([
        ApiTokenRepository.getGlobalApiTokenStats(),
        UserTokenRepository.getGlobalTokenStats(),
      ]);
      return {
        apiTokens,
        userTokens: {
          total: userTokens.totalTokens,
          active: userTokens.activeTokens,
          expired: userTokens.expiredTokens,
          revoked: userTokens.revokedTokens,
        },
        // 旧字段：保留以过渡，等所有调用方迁到新结构后删除。
        totalTokens: userTokens.totalTokens,
        activeTokens: userTokens.activeTokens,
        expiredTokens: userTokens.expiredTokens,
        revokedTokens: userTokens.revokedTokens,
      };
    } catch (error) {
      throw new BusinessError(
        SystemManageErrorCode.CRON_JOB_FAILED,
        `获取token统计信息失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }
}