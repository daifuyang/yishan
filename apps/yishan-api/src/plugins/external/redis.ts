import fp from 'fastify-plugin'
import fastifyRedis, { FastifyRedis } from '@fastify/redis'

export default fp(async (fastify, opts) => {
  const redisConfig = {
    host: fastify.config.REDIS_HOST,
    port: fastify.config.REDIS_PORT,
    password: fastify.config.REDIS_PASSWORD,
    db: fastify.config.REDIS_DB,
    ...opts
  }

  fastify.register(fastifyRedis, redisConfig)

  fastify.addHook('onClose', async (instance) => {
    if (instance.redis) {
      await instance.redis.quit()
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