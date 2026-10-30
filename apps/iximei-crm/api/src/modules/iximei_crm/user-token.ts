/**
 * 令牌撤销。
 *
 * 上游 `@yishan/core-system-api` 有同等的 `UserTokenRepository`，但 export map 没有
 * 暴露 `./repositories/*`。crm 需要的只是「把某个用户的全部令牌置为已撤销」这一件事，
 * 与其让上游开口子，不如在这里直接用表写——语义窄、可审计。
 *
 * 表结构两边一致（sys_user_token 有 is_revoked / revoked_at / updated_at），
 * 因此这段实现换基座前后行为相同。
 */
import { and, eq, isNull } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { sysUserToken } from '@yishan/core-system-api/schema'

export const UserTokenRepository = {
  /** 撤销某用户的全部有效令牌（改密 / 禁用 / 删除账号后调用）。 */
  async revokeAllByUserId(userId: number, db: AppQueryDb = drizzleDb): Promise<void> {
    if (!Number.isFinite(userId) || userId <= 0) return
    await db
      .update(sysUserToken)
      .set({ isRevoked: true, revokedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(sysUserToken.userId, userId),
        eq(sysUserToken.isRevoked, false),
        isNull(sysUserToken.deletedAt),
      ))
  },
}
