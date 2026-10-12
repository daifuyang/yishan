import type { FastifyInstance } from 'fastify'
import type {} from '@fastify/cookie'
import type {} from '@fastify/swagger'
import fastifyRedis, { type FastifyRedis } from '@fastify/redis'
import { cookiePlugin, multipartPlugin, sensiblePlugin, typeboxPlugin, swaggerPlugin, errorHandlerPlugin } from '@yishan/core-api/plugins'
import schemas from './core/schemas'
import jwtAuth from './core/plugins/external/jwt-auth'
import rbac from './core/plugins/external/rbac'
import rateLimit from './core/plugins/external/rate-limit'
import security from './core/plugins/external/security'
import audit from './core/plugins/external/audit'
import staticAssets from './core/plugins/external/static'
import dictMap from './core/plugins/app/dict-map'
import passwordManager from './core/plugins/app/password-manager'
import type { SystemRuntime } from './runtime'
import type { AppDb } from './db'

declare module 'fastify' {
  interface FastifyInstance {
    system: SystemRuntime
    db: AppDb
    drizzleDb: AppDb
    redis: FastifyRedis
  }
}

export async function setupSystem(fastify: FastifyInstance, runtime: SystemRuntime): Promise<void> {
  fastify.addHook('onRoute', route => {
    const code = route.schema?.['x-permission-code']
    const label = route.schema?.['x-permission-label']
    const group = route.schema?.['x-permission-group']
    if (code && label && group && !runtime.permissions.has(code)) runtime.permissions.register({ code, label, group })
  })
  fastify.decorate('system', runtime)
  fastify.decorate('db', runtime.database.db)
  fastify.decorate('drizzleDb', runtime.database.db)
  fastify.decorate('dbHealthCheck', () => runtime.database.healthCheck())
  fastify.decorate('dbStatus', () => runtime.database.getConnectionStatus())
  await fastify.register(errorHandlerPlugin, { production: runtime.config.APP_CONFIG.nodeEnv === 'production' })
  await fastify.register(cookiePlugin)
  await fastify.register(sensiblePlugin)
  await fastify.register(typeboxPlugin)
  await fastify.register(multipartPlugin)
  await fastify.register(swaggerPlugin)
  await fastify.register(schemas)
  if (runtime.options.redis !== false) {
    await fastify.register(fastifyRedis, { ...runtime.config.REDIS_CONFIG, lazyConnect: true, enableOfflineQueue: false, ...runtime.options.redis })
  }
  await fastify.register(rateLimit)
  await fastify.register(jwtAuth)
  await fastify.register(rbac)
  await fastify.register(security)
  await fastify.register(audit)
  await fastify.register(dictMap)
  await fastify.register(passwordManager)
  if (runtime.options.staticAssets !== false) await fastify.register(staticAssets)
}
