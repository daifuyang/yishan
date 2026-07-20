import type { FastifyInstance } from 'fastify'

import type {
  PluginRegister,
  PluginRuntimeState,
  PluginServer,
} from './types.js'

export const PLUGIN_DISABLED = 'PLUGIN_DISABLED'
export const PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND'
export const PLUGIN_FAILED = 'PLUGIN_FAILED'

export function registerPluginGate(fastify: FastifyInstance): void {
  const server = fastify as PluginServer
  if (fastify.hasDecorator('pluginState')) {
    server.pluginState = new Map<string, PluginRuntimeState>()
    return
  }
  fastify.decorate('pluginState', new Map<string, PluginRuntimeState>())
}

export function setPluginState(
  fastify: FastifyInstance,
  pluginId: string,
  state: PluginRuntimeState,
): void {
  const server = fastify as PluginServer
  if (!server.pluginState) {
    server.pluginState = new Map<string, PluginRuntimeState>()
  }
  server.pluginState.set(pluginId, state)
}

export function pluginGate(pluginId: string) {
  return async (request: Parameters<PluginServer['authenticate']>[0], reply: Parameters<PluginServer['authenticate']>[1]): Promise<void> => {
    const state = (request.server as PluginServer).pluginState?.get(pluginId)
    if (state === undefined) {
      reply.code(404).send({
        success: false,
        code: PLUGIN_NOT_FOUND,
        message: `Plugin ${pluginId} not in profile`,
      })
      return
    }
    if (state === 'failed') {
      reply.code(503).send({
        success: false,
        code: PLUGIN_FAILED,
        message: `Plugin ${pluginId} is failed`,
      })
      return
    }
    if (state !== 'enabled') {
      reply.code(404).send({
        success: false,
        code: PLUGIN_DISABLED,
        message: `Plugin ${pluginId} is ${state}`,
      })
    }
  }
}

/** Mount a plugin's explicit registrar inside its isolated runtime gate. */
export async function registerPlugin(
  app: FastifyInstance,
  pluginId: string,
  registerFn: PluginRegister,
): Promise<void> {
  await app.register(async (instance) => {
    instance.addHook('preHandler', pluginGate(pluginId))
    await registerFn(instance)
  })
}
