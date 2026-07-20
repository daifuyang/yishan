import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export const PLUGIN_DISABLED = 'PLUGIN_DISABLED'
export const PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND'
export const PLUGIN_FAILED = 'PLUGIN_FAILED'

export type PluginRuntimeState = 'installed' | 'enabled' | 'disabled' | 'failed'

declare module 'fastify' {
  interface FastifyInstance {
    pluginState: Map<string, PluginRuntimeState>
  }
}

export function registerPluginGate(fastify: FastifyInstance): void {
  fastify.decorate('pluginState', new Map<string, PluginRuntimeState>())
}

export function setPluginState(
  fastify: FastifyInstance,
  pluginId: string,
  state: PluginRuntimeState,
): void {
  if (!fastify.pluginState) {
    fastify.pluginState = new Map<string, PluginRuntimeState>()
  }
  fastify.pluginState.set(pluginId, state)
}

export function pluginGate(pluginId: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const state = (request.server as FastifyInstance).pluginState?.get(pluginId)
    if (state === undefined) {
      return reply.code(404).send({
        success: false,
        code: PLUGIN_NOT_FOUND,
        message: `Plugin ${pluginId} not in profile`,
      })
    }
    if (state === 'failed') {
      return reply.code(503).send({
        success: false,
        code: PLUGIN_FAILED,
        message: `Plugin ${pluginId} is failed`,
      })
    }
    if (state !== 'enabled') {
      return reply.code(404).send({
        success: false,
        code: PLUGIN_DISABLED,
        message: `Plugin ${pluginId} is ${state}`,
      })
    }
  }
}
