import fp from 'fastify-plugin'
import fastifyRedis, { FastifyRedis } from '@fastify/redis'

export default fp(async (fastify, opts) => {
  const redisConfig = {
    host: fastify.config.REDIS_HOST,
    port: fastify.config.REDIS_PORT,
    password: fastify.config.REDIS_PASSWORD,
    db: fastify.config.REDIS_DB,
    connectTimeout: 5000, // 5秒连接超时
    lazyConnect: false, // 立即连接，不延迟
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    ...opts
  }

  try {
    await fastify.register(fastifyRedis, redisConfig)
    
    // 测试Redis连接
    await fastify.redis.ping()
    // 只在生产环境记录连接成功日志
    if (process.env.NODE_ENV === 'production') {
      fastify.log.info('Redis连接成功')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    fastify.log.error(`Redis连接失败: ${errorMessage}`)
    throw new Error(`Redis连接失败: ${errorMessage}`)
  }

  fastify.addHook('onClose', async (instance) => {
    if (instance.redis) {
      try {
        await instance.redis.quit()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        fastify.log.warn(`Redis关闭连接时出错: ${errorMessage}`)
      }
    }
  })
}, {
  name: 'redis',
  dependencies: ['env']
})

export const autoConfig = {
  // 默认配置可以在这里添加
}

// 扩展 Fastify 类型定义
declare module 'fastify' {
  interface FastifyInstance {
    redis: FastifyRedis
  }
}