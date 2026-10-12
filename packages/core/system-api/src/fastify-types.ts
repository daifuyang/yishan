import type { FastifyInstance } from 'fastify'
export type { FastifyCookieOptions } from '@fastify/cookie'
export type { FastifySwaggerOptions } from '@fastify/swagger'

export type SystemSetup = typeof import('./setup').setupSystem
export type SystemAuthentication = typeof import('./core/plugins/external/jwt-auth').default
export type SystemAuthorization = typeof import('./core/plugins/external/rbac').default
export type SystemRateLimit = typeof import('./core/plugins/external/rate-limit').default
export type SystemDictionaries = typeof import('./core/plugins/app/dict-map').default

export type SystemFastifyInstance = FastifyInstance
