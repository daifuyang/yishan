import 'fastify'
import '@fastify/redis'

/**
 * Module 通过 `addHook('onRoute')` 把 meta.id 写入 route.config，
 * Core 在 onRoute 钩子中读取该字段做 prefix 唯一性校验。
 */
declare module 'fastify' {
  interface FastifyContextConfig {
    moduleId?: string
  }

  /**
   * app.ts 启动期挂到 fastify 实例上的装饰器。
   * 在 ambient types 里声明，所有路由文件直接可见，无需 (as unknown as ...) 绕道。
   */
  interface FastifyInstance {
    moduleLoader: import('../core/module-loader/module-loader.js').ModuleLoader
    appRootDist: string
    appRootSrc: string
  }
}

/**
 * `@fastify/redis` 默认以 `fastify.redis` 暴露客户端；我们只用到 get/set/del。
 * 完整 Redis 类型从 `ioredis` 继承即可，这里只声明我们用到的那部分形状。
 *
 * 注：标为可选 —— `@fastify/redis` 是注册期可选依赖，模块代码
 * (`module-loader`) 会先 `if (fastify.redis)` 判空再使用。
 */
declare module '@fastify/redis' {
  interface FastifyInstance {
    redis?: {
      get(key: string): Promise<string | null>
      set(key: string, value: string, ...args: unknown[]): Promise<unknown>
      del(key: string): Promise<unknown>
    }
  }
}
