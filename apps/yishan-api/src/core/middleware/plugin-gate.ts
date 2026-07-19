import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export const PLUGIN_DISABLED = 'PLUGIN_DISABLED'
export const PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND'
export const PLUGIN_FAILED = 'PLUGIN_FAILED'

/**
 * Runtime lifecycle states tracked per plugin (ADR-003 §3.2).
 *
 * Maps to the four-state machine defined in PROPOSAL §3.2:
 *  - installed: discovered and persisted; gates still treat as disabled
 *  - enabled:   allows traffic through pluginGate
 *  - disabled:  refuses traffic with PLUGIN_DISABLED
 *  - failed:    refuses traffic with PLUGIN_FAILED (state transition only
 *               happens once admin retries; see ADR-003 §"Consequences")
 */
export type PluginRuntimeState = 'installed' | 'enabled' | 'disabled' | 'failed'

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * In-memory cache of plugin runtime state, keyed by plugin id (e.g.
     * `yishan/hello`). Boot-time populated by `registerPluginGate` +
     * `setPluginState` calls driven from the catalog + persistence layer;
     * runtime enable/disable endpoints MUST invalidate via `setPluginState`
     * so that the gate returns fresh decisions. Wave 4 only does the boot
     * warmup; live invalidation is a Wave 5 concern (catalog gate /
     * sysadmin endpoint) — gate still chooses from this snapshot then.
     */
    pluginState: Map<string, PluginRuntimeState>
  }
}

/**
 * Decorate the Fastify instance with an empty `pluginState` map. Idempotent
 * — calling twice replaces the previous map so callers can re-init during
 * boot without leaking duplicate decorations.
 */
export function registerPluginGate(fastify: FastifyInstance): void {
  fastify.decorate('pluginState', new Map<string, PluginRuntimeState>())
}

/**
 * Helper for callers that want to seed / update a plugin's runtime state
 * without poking the decorator directly. Lives next to the gate so the
 * boot wiring and the runtime mutation surface stay co-located.
 */
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

/**
 * Build a Fastify preHandler that enforces the ADR-003 §3.2 gate for a
 * single plugin. Wrap each plugin's router sub-app with `instance.addHook(
 * 'preHandler', pluginGate(pluginId))` so the check runs before any route
 * handler; a disabled plugin returns 404 + PLUGIN_DISABLED instead of the
 * usual 200, and a failed plugin returns 503 + PLUGIN_FAILED.
 *
 * For an unknown plugin id (i.e. one the catalog did not pick) the gate
 * follows PROPOSAL §3.2 ("catalog is the unique source") and returns
 * 404 + PLUGIN_NOT_FOUND.
 */
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
