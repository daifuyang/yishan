import fp from 'fastify-plugin'
import fastifyRedis, { FastifyRedis } from '@fastify/redis'

export default fp(async (fastify, opts) => {
  // 测试环境特殊配置
  const isTestEnv = process.env.NODE_ENV === 'test'
  
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    connectTimeout: isTestEnv ? 5000 : 10000, // 测试环境缩短超时时间
    lazyConnect: isTestEnv ? true : false, // 测试环境使用延迟连接
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: isTestEnv ? 2 : 3, // 测试环境减少重试次数
    keepAlive: isTestEnv ? 0 : 30000, // 测试环境禁用keepalive
    family: 4, // 强制使用IPv4
    enableOfflineQueue: false, // 禁用离线队列
    // 测试环境连接池优化
    ...(isTestEnv && {
      retryDelayOnClusterDown: 300,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      showFriendlyErrorStack: true
    }),
    ...opts
  }

  try {
    await fastify.register(fastifyRedis, redisConfig)
    
    // 测试Redis连接
    if (fastify.redis) {
      await fastify.redis.ping()
      // 只在生产环境记录连接成功日志
      if (process.env.NODE_ENV === 'production') {
        fastify.log.info('Redis连接成功')
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (isTestEnv) {
      // 测试环境Redis连接失败时的处理
      fastify.log.warn(`测试环境Redis连接失败: ${errorMessage}`)
      // 不抛出错误，允许测试继续进行
      return
    } else {
      fastify.log.error(`Redis连接失败: ${errorMessage}`)
      throw new Error(`Redis连接失败: ${errorMessage}`)
    }
  }

  // 不需要手动添加onClose钩子，@fastify/redis插件会自动处理连接关闭
  // 移除自定义的onClose钩子以避免重复关闭连接的问题
}, {
  name: 'redis'
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