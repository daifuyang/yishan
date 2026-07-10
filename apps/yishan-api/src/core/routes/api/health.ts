import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { dateUtils } from '../../../utils/date.js'
import { ResponseUtil } from '../../../utils/response.js'

/**
 * 服务健康检查
 * 路径：GET /api/health（autoload 按 core/routes/api/ 目录自动加 api 前缀）
 * 用于 K8s livenessProbe / 负载均衡器健康探测
 *
 * 注意：根路径 GET / 由 static.ts redirect 到 /admin/，不要再注册到这里
 */
const health: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    '/health',
    {
      schema: {
        summary: '服务健康检查',
        description: '返回服务的健康状态、版本号和当前时间',
        operationId: 'healthCheck',
        tags: ['system'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              code: { type: 'number' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  version: { type: 'string' },
                  timestamp: { type: 'string' }
                }
              },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return ResponseUtil.success(
        reply,
        {
          status: 'ok',
          version: process.env.npm_package_version || '1.0.0',
          timestamp: dateUtils.now()
        },
        'Service is healthy'
      )
    }
  )
}

export default health