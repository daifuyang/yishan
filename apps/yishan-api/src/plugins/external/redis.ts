import fp from 'fastify-plugin'
import fastifyRedis, { FastifyRedis } from '@fastify/redis'

export default fp(async (fastify, opts) => {
  // 测试环境特殊配置
  const isTestEnv = process.env.NODE_ENV === 'test'
  
  // 解析 REDIS_URL 或使用单独的环境变量
  let redisConfig: any = {}
  
  if (process.env.REDIS_URL) {
    // 解析 REDIS_URL 格式: redis://:password@host:port/db
    try {
      const url = new URL(process.env.REDIS_URL)
      redisConfig = {
        host: url.hostname || 'localhost',
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        db: parseInt(url.pathname.slice(1)) || 0, // 移除开头的 '/'
      }
    } catch (error) {
      fastify.log.error('REDIS_URL 格式错误，使用默认配置')
      redisConfig = {
        host: 'localhost',
        port: 6379,
        db: 0
      }
    }
  } else {
    // 使用单独的环境变量
    redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    }
  }
  
  // 添加通用配置
  redisConfig = {
    ...redisConfig,
    connectTimeout: 5000,
    lazyConnect: true,
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
    
    // 在 onReady 阶段强制建立连接，保证顺序在数据库之后
    fastify.addHook('onReady', async () => {
      try {
        if (process.env.DEBUG_MODE === '1') {
          const { host, port, db } = redisConfig
          fastify.log.info({ host, port, db }, 'redis connect config')
        }
        await fastify.redis.ping()
        fastify.log.info('Redis连接成功')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        fastify.log.error(`Redis连接失败: ${msg}`)
        throw e
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    fastify.log.error(`Redis插件注册失败: ${errorMessage}`)
    throw new Error(`Redis插件注册失败: ${errorMessage}`)
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
