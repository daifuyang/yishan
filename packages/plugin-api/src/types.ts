import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify'

import type { PermissionRef } from './permissions.js'

export type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest }

export type PluginRuntimeState = 'installed' | 'enabled' | 'disabled' | 'failed'

export type PluginAuthHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void

export type PluginPermissionHandler = preHandlerHookHandler & {
  permission?: PermissionRef
}

/** Runtime decorators supplied by the Yishan API host to plugin routes. */
export interface PluginServerDecorators {
  authenticate: PluginAuthHandler
  requirePermission: (permission: PermissionRef) => PluginPermissionHandler
  pluginState: Map<string, PluginRuntimeState>
}

/** Fastify server surface available to runtime plugins. */
export type PluginServer = FastifyInstance & PluginServerDecorators

export type PluginRegister = (
  app: FastifyInstance,
) => Promise<void> | void

export type PluginServerPlugin = FastifyPluginAsync
