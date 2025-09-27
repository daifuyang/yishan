import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { TokenCleanupService } from '../../services/tokenCleanupService.js'

declare module 'fastify' {
  interface FastifyInstance {
    tokenCleanup: TokenCleanupService
  }
}

export default fp(async function tokenCleanupPlugin(fastify: FastifyInstance) {
  const tokenCleanupService = new TokenCleanupService(fastify)
  
  // 注册到 fastify 实例
  fastify.decorate('tokenCleanup', tokenCleanupService)
  
  // Serverless环境下仅初始化服务，不启动定时器
  fastify.addHook('onReady', async () => {
    tokenCleanupService.start()
    fastify.log.info('Token cleanup service initialized for Serverless environment')
  })
  
  // 应用关闭时停止清理服务
  fastify.addHook('onClose', async () => {
    tokenCleanupService.stop()
    fastify.log.info('Token cleanup service stopped')
  })
}, {
  name: 'token-cleanup'
})