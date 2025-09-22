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
      multipleStatements: true
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations'
    },
    acquireConnectionTimeout: 60000,
    ...opts
  })

  fastify.decorate('knex', knexInstance)

  fastify.addHook('onClose', async (instance) => {
    if (instance.knex) {
      await instance.knex.destroy()
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