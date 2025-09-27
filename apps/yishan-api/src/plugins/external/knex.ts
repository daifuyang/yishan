import fp from 'fastify-plugin'
import knex from 'knex'

export default fp(async (fastify, opts) => {
  const knexInstance = knex({
    client: 'mysql2',
    connection: {
      host: fastify.config.MYSQL_HOST,
      port: fastify.config.MYSQL_PORT,
      user: fastify.config.MYSQL_USER,
      password: fastify.config.MYSQL_PASSWORD,
      database: fastify.config.MYSQL_DATABASE,
      multipleStatements: true,
      connectTimeout: 10000 // 10秒连接超时
    },
    pool: {
      min: 2,
      max: 10,
      createTimeoutMillis: 10000,
      acquireTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100
    },
    migrations: {
      directory: './migrations'
    },
    acquireConnectionTimeout: 10000,
    ...opts
  })

  try {
    // 测试数据库连接
    await knexInstance.raw('SELECT 1')
    fastify.log.info('MySQL数据库连接成功')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    fastify.log.error(`MySQL数据库连接失败: ${errorMessage}`)
    await knexInstance.destroy()
    throw new Error(`MySQL数据库连接失败: ${errorMessage}`)
  }

  fastify.decorate('knex', knexInstance)

  fastify.addHook('onClose', async (instance) => {
    if (instance.knex) {
      try {
        await instance.knex.destroy()
        fastify.log.info('MySQL数据库连接已关闭')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        fastify.log.warn(`MySQL关闭连接时出错: ${errorMessage}`)
      }
    }
  })
})

export const autoConfig = {
  // 默认配置可以在这里添加
}

// 扩展 Fastify 类型定义
declare module 'fastify' {
  interface FastifyInstance {
    knex: knex.Knex
  }
}