import 'fastify'

/**
 * Module 通过 `addHook('onRoute')` 把 meta.id 写入 route.config，
 * Core 在 onRoute 钩子中读取该字段做 prefix 唯一性校验。
 */
declare module 'fastify' {
  interface FastifyContextConfig {
    moduleId?: string
  }
}