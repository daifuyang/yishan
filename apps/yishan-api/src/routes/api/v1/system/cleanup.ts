import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ResponseUtil } from '../../../../utils/response.js'
import { CommonBusinessCode } from '../../../../constants/business-code.js'
import { TokenCleanupService } from '../../../../services/tokenCleanupService.js'

export default async function cleanupRoutes(fastify: FastifyInstance) {
  
  // Token清理API - 支持外部触发
  fastify.post('/cleanup/tokens', {
    schema: {
      tags: ['system'],
      summary: 'Token清理',
      description: '清理过期的用户认证Token，通过外部中间件触发执行',
      operationId: 'cleanupTokens',
      headers: {
        type: 'object',
        properties: {
          'x-cleanup-key': { 
            type: 'string', 
            description: '清理服务密钥，用于验证外部中间件调用权限' 
          }
        },
        required: ['x-cleanup-key']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: 'Token清理完成' },
            data: {
              type: 'object',
              properties: {
                deletedCount: { type: 'number', description: '清理的token数量' },
                executionTime: { type: 'string', description: '执行时间' },
                timestamp: { type: 'string', description: '清理时间戳' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40001 },
            message: { type: 'string', example: '无效的清理密钥' }
          }
        },
        500: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 50001 },
            message: { type: 'string', example: '清理服务执行失败' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{
      Headers: {
        'x-cleanup-key': string
      }
    }>,
    reply: FastifyReply
  ) => {
    try {
      // 验证清理密钥
      const cleanupKey = request.headers['x-cleanup-key']
      const expectedKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      
      if (cleanupKey !== expectedKey) {
        return ResponseUtil.error(
          reply,
          request,
          '无效的清理密钥',
          CommonBusinessCode.UNAUTHORIZED
        )
      }

      const startTime = Date.now()
      
      // 创建TokenCleanupService实例并执行清理
      const tokenCleanupService = new TokenCleanupService(fastify)
      const deletedCount = await tokenCleanupService.executeCleanup()
      
      const executionTime = `${Date.now() - startTime}ms`
      
      return ResponseUtil.send(
          reply,
          request,
          {
            deletedCount,
            executionTime,
            timestamp: new Date().toISOString()
          },
          'Token清理完成',
          CommonBusinessCode.SUCCESS
        )
    } catch (error) {
        fastify.log.error(error)
        return ResponseUtil.error(
          reply,
          request,
          'Token清理执行失败',
          CommonBusinessCode.INTERNAL_SERVER_ERROR,
          error
        )
    }
  })

  // 清理状态查询API
  fastify.get('/cleanup/status', {
    schema: {
      tags: ['system'],
      summary: '清理状态查询',
      description: '查询Token清理服务的状态信息',
      operationId: 'getCleanupStatus',
      headers: {
        type: 'object',
        properties: {
          'x-cleanup-key': { 
            type: 'string', 
            description: '清理服务密钥' 
          }
        },
        required: ['x-cleanup-key']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '获取清理状态成功' },
            data: {
              type: 'object',
              properties: {
                serviceType: { type: 'string', description: '服务类型' },
                environment: { type: 'string', description: '运行环境' },
                lastCleanupTime: { type: 'string', description: '最后清理时间' },
                totalTokens: { type: 'number', description: '总token数量' },
                expiredTokens: { type: 'number', description: '过期token数量' },
                revokedTokens: { type: 'number', description: '已撤销token数量' }
              }
            }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{
      Headers: {
        'x-cleanup-key': string
      }
    }>,
    reply: FastifyReply
  ) => {
    try {
      // 验证清理密钥
      const cleanupKey = request.headers['x-cleanup-key']
      const expectedKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      
      if (cleanupKey !== expectedKey) {
        return ResponseUtil.error(
          reply,
          request,
          '无效的清理密钥',
          CommonBusinessCode.UNAUTHORIZED
        )
      }

      // 创建TokenCleanupService实例并获取统计信息
      const tokenCleanupService = new TokenCleanupService(fastify)
      const stats = await tokenCleanupService.getCleanupStats()
      
      return ResponseUtil.send(
          reply,
          request,
          {
            serviceType: 'API-Triggered',
            environment: 'Serverless',
            lastCleanupTime: stats.lastCleanupTime || 'Never',
            totalTokens: stats.totalTokens,
            expiredTokens: stats.expiredTokens,
            revokedTokens: stats.revokedTokens
          },
          '获取清理状态成功',
          CommonBusinessCode.SUCCESS
        )
    } catch (error) {
        fastify.log.error(error)
        return ResponseUtil.error(
          reply,
          request,
          '获取清理状态失败',
          CommonBusinessCode.INTERNAL_SERVER_ERROR,
          error
        )
    }
  })
}