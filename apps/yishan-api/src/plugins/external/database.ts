import fp from 'fastify-plugin'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { prismaManager } from '../../utils/prisma.js'

/**
 * 数据库连接插件选项接口
 */
interface DatabasePluginOptions extends FastifyPluginOptions {
  /** 是否在启动时自动连接数据库 */
  autoConnect?: boolean
  /** 连接重试次数 */
  retryAttempts?: number
  /** 重试间隔（毫秒） */
  retryDelay?: number
}

/**
 * 数据库连接插件
 * 
 * 功能：
 * 1. 自动管理数据库连接生命周期
 * 2. 提供数据库健康检查接口
 * 3. 支持连接重试机制
 * 4. 优雅关闭数据库连接
 */
async function databasePlugin(
  fastify: FastifyInstance,
  options: DatabasePluginOptions = {}
) {
  const {
    autoConnect = true,
    retryAttempts = 3,
    retryDelay = 2000
  } = options

  // 连接重试函数
  const connectWithRetry = async (): Promise<void> => {
    let attempts = 0
    while (attempts < retryAttempts) {
      try {
        await prismaManager.connect()
        return
      } catch (error) {
        attempts++
        if (attempts >= retryAttempts) {
          throw error
        }
        fastify.log.warn(`Database connection attempt ${attempts} failed, retrying in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }

  // 装饰器：添加 Prisma 客户端到 Fastify 实例
  fastify.decorate('prisma', prismaManager.getClient())

  // 装饰器：添加数据库健康检查方法
  fastify.decorate('dbHealthCheck', async () => {
    try {
      const isHealthy = await prismaManager.healthCheck()
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error(`Database health check failed: ${String(error)}`)
      return {
        status: 'error',
        timestamp: new Date().toISOString()
      }
    }
  })

  // 装饰器：添加数据库状态查询方法
  fastify.decorate('dbStatus', () => {
    const status = prismaManager.getConnectionStatus()
    return {
      connected: status.connected,
      status: status.connected ? 'connected' : 'disconnected',
      stats: status.stats
    }
  })

  // 装饰器：添加数据库重连方法
  fastify.decorate('dbReconnect', async () => {
    try {
      await prismaManager.disconnect()
      await connectWithRetry()
      return { success: true, message: 'Database reconnected successfully' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      fastify.log.error(`Database reconnection failed: ${errorMessage}`)
      return { success: false, message: errorMessage }
    }
  })

  // 应用启动时的数据库连接
  if (autoConnect) {
    fastify.addHook('onReady', async () => {
      try {
        fastify.log.info('🔄 Initializing database connection...')
        await connectWithRetry()
      } catch (error) {
        // 根据环境决定是否抛出错误
        if (process.env.NODE_ENV === 'production') {
          throw error // 生产环境必须有数据库连接
        } else {
          fastify.log.warn('⚠️ Development mode: Application will continue without database connection')
        }
      }
    })
  }

  // 应用关闭时断开数据库连接
  fastify.addHook('onClose', async () => {
    try {
      await prismaManager.disconnect()
      fastify.log.info('📴 Database connection closed successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      fastify.log.error(`Database disconnection error: ${errorMessage}`)
    }
  })
}

// 声明 Fastify 类型扩展
declare module 'fastify' {
  interface FastifyInstance {
    prisma: ReturnType<typeof prismaManager.getClient>
    dbHealthCheck(): Promise<{
      status: 'healthy' | 'unhealthy' | 'error'
      timestamp: string
    }>
    dbStatus(): {
      connected: boolean
      status: 'connected' | 'disconnected'
      stats: any
    }
    dbReconnect(): Promise<{
      success: boolean
      message: string
    }>
  }
}

export default fp(databasePlugin, {
  name: 'database',
  dependencies: []
})