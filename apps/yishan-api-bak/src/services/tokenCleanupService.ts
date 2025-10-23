import { FastifyInstance } from 'fastify'
import { Knex } from 'knex'
import { TokenRepository } from '../repository/tokenRepository.js'

export interface CleanupStats {
  totalTokens: number
  expiredTokens: number
  revokedTokens: number
  lastCleanupTime?: string
}

export class TokenCleanupService {
  private tokenRepository: TokenRepository
  private fastify: FastifyInstance
  private knex: Knex
  private lastCleanupTime?: string

  constructor(fastify: FastifyInstance) {
    this.tokenRepository = new TokenRepository(fastify)
    this.fastify = fastify
    this.knex = fastify.knex
  }

  /**
   * 执行Token清理 - 通过外部中间件调用
   */

  /**
   * 手动执行清理 - 主要清理方法，由API触发
   */
  async executeCleanup(): Promise<number> {
    try {
      const startTime = Date.now()
      const deletedCount = await this.tokenRepository.cleanupExpiredTokens()
      const executionTime = Date.now() - startTime
      
      this.lastCleanupTime = new Date().toISOString()
      
      this.fastify.log.info({
        deletedCount,
        executionTime: `${executionTime}ms`,
        timestamp: this.lastCleanupTime
      }, 'Token清理完成 (外部中间件触发)')
      
      return deletedCount
    } catch (error) {
      this.fastify.log.error(error)
      throw error
    }
  }

  /**
   * 获取清理统计信息
   */
  async getCleanupStats(): Promise<CleanupStats> {
    try {
      // 获取所有token的统计信息
      const now = new Date().toISOString()
      
      const stats = await this.knex('sys_user_token')
        .select(
          this.knex.raw('COUNT(*) as total'),
          this.knex.raw('SUM(CASE WHEN access_token_expires_at < ? AND refresh_token_expires_at < ? THEN 1 ELSE 0 END) as expired', [now, now]),
          this.knex.raw('SUM(CASE WHEN is_revoked = 1 THEN 1 ELSE 0 END) as revoked')
        )
        .first()

      return {
        totalTokens: parseInt(stats?.total || '0'),
        expiredTokens: parseInt(stats?.expired || '0'),
        revokedTokens: parseInt(stats?.revoked || '0'),
        lastCleanupTime: this.lastCleanupTime
      }
    } catch (error) {
      this.fastify.log.error(error)
      throw error
    }
  }

  /**
   * 检查服务健康状态
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    message: string
    timestamp: string
  }> {
    try {
      // 尝试连接数据库并执行简单查询
      await this.knex('sys_user_token').count('* as count').first()
      
      return {
        status: 'healthy',
        message: 'Token清理服务运行正常',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Token清理服务异常: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      }
    }
  }
}