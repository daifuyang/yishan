import fp from 'fastify-plugin'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { prismaManager } from '../../utils/prisma.js'
import { BusinessError } from '../../exceptions/business-error.js'
import { SystemErrorCode } from '../../constants/business-codes/common.js'

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
  /** 连接超时（毫秒），超时则直接抛出数据库错误 */
  connectionTimeout?: number
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
    connectionTimeout = 5000
  } = options

  // 快速失败的连接函数：在超时时间内尝试一次连接，失败直接抛数据库错误
  const connectOrFailFast = async (): Promise<void> => {
    try {
      const prisma = prismaManager.getClient()

      await Promise.race([
        prisma.$connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('CONNECTION_TIMEOUT')), connectionTimeout))
      ])

      // 连接后进行一次轻量健康检查，确保连接可用
      await prisma.$queryRaw`SELECT 1`
      fastify.log.info('Database connected and healthy')
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      const isTimeout = errMsg === 'CONNECTION_TIMEOUT'
      const details = isTimeout ? `连接超时（>${connectionTimeout}ms）` : errMsg
      throw new BusinessError(
        SystemErrorCode.DATABASE_ERROR,
        isTimeout ? '数据库连接超时，请检查网络与数据库服务状态' : '数据库连接失败，请检查数据库配置或服务状态',
        details
      )
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
      await connectOrFailFast()
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
        fastify.log.info('Initializing database connection...')
        await connectOrFailFast()
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Unknown database error'
        fastify.log.error(`Database initialization failed: ${errMessage}`)
        // 无论环境，直接抛出数据库错误，避免启动阶段出现插件超时
        throw error
      }
    })
  }

  // 应用关闭时断开数据库连接
  fastify.addHook('onClose', async () => {
    try {
      await prismaManager.disconnect()
      fastify.log.info('Database connection closed successfully')
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
