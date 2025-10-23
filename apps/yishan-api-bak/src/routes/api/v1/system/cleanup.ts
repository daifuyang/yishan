import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { TokenCleanupService } from '../../../../services/tokenCleanupService.js'
import { ErrorCode } from '../../../../constants/business-code.js'
import { ResponseUtil } from '../../../../utils/response.js'

const cleanupRoutes: FastifyPluginAsync = async function (fastify, opts) {
  const tokenCleanupService = new TokenCleanupService(fastify)

  // 手动触发 Token 清理（删除数据库中过期的令牌记录）
  fastify.post('/tokens/cleanup', {
    schema: {
      operationId: 'cleanupTokens',
      summary: '清理过期Token',
      description: '删除数据库中已过期的访问令牌与刷新令牌记录',
      tags: ['sysCleanup'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: 'Token清理完成' },
            data: {
              type: 'object',
              properties: {
                deletedCount: { type: 'number', description: '删除的过期令牌记录数量' }
              }
            }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        403: { $ref: 'forbiddenResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request: FastifyRequest, reply) => {
      try {
        // 检查用户权限，仅管理员可执行
        const user = (request as any).user
        if (!user || user.role !== 'admin') {
          return ResponseUtil.forbidden(
            reply,
            request,
            '权限不足，仅管理员可执行此操作'
          )
        }

        const deletedCount = await tokenCleanupService.executeCleanup()
        const message = `Token清理完成，删除 ${deletedCount} 条过期记录`

        return ResponseUtil.success(
          reply,
          request,
          { deletedCount },
          message
        )
      } catch (error) {
        fastify.log.error(error)
        const errorMessage = error instanceof Error ? error.message : '清理Token失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 获取 Token 清理统计信息
  fastify.get('/tokens/stats', {
    schema: {
      operationId: 'getTokenCleanupStats',
      summary: 'Token清理统计',
      description: '查看令牌总量、已过期、已撤销数量及最近清理时间',
      tags: ['sysCleanup'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: {
              type: 'object',
              properties: {
                totalTokens: { type: 'number' },
                expiredTokens: { type: 'number' },
                revokedTokens: { type: 'number' },
                lastCleanupTime: { type: 'string' }
              }
            }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        403: { $ref: 'forbiddenResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request: FastifyRequest, reply) => {
      try {
        const user = (request as any).user
        if (!user || user.role !== 'admin') {
          return ResponseUtil.forbidden(
            reply,
            request,
            '权限不足，仅管理员可查看'
          )
        }

        const stats = await tokenCleanupService.getCleanupStats()
        return ResponseUtil.success(reply, request, stats, '获取成功')
      } catch (error) {
        fastify.log.error(error)
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          '获取Token清理统计失败'
        )
      }
    }
  })

  // Token 清理服务健康检查
  fastify.get('/tokens/health', {
    schema: {
      operationId: 'tokenCleanupHealth',
      summary: 'Token清理健康检查',
      description: '检查Token清理服务与数据库连接状态',
      tags: ['sysCleanup'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['healthy', 'unhealthy'] },
                message: { type: 'string' },
                timestamp: { type: 'string' }
              }
            }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        403: { $ref: 'forbiddenResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request: FastifyRequest, reply) => {
      try {
        const user = (request as any).user
        if (!user || user.role !== 'admin') {
          return ResponseUtil.forbidden(
            reply,
            request,
            '权限不足，仅管理员可查看'
          )
        }

        const health = await tokenCleanupService.healthCheck()
        return ResponseUtil.success(reply, request, health, '获取成功')
      } catch (error) {
        fastify.log.error(error)
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          '检查Token清理服务失败'
        )
      }
    }
  })
}

export default cleanupRoutes
