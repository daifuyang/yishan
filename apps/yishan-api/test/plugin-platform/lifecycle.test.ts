import { describe, expect, it } from 'vitest'
import { PluginLifecycle } from '../../src/core/plugin-platform/lifecycle'
import { PluginRegistry } from '../../src/core/plugin-platform/registry'

describe('PluginLifecycle', () => {
  it('allows valid transitions', () => {
    const registry = new PluginRegistry()
    registry.register({ name: 'hello', version: '1.0.0' })
    const lifecycle = new PluginLifecycle(registry)

    lifecycle.load('hello')
    lifecycle.enable('hello')
    lifecycle.disable('hello')
    lifecycle.unload('hello')

    expect(registry.get('hello')?.state).toBe('unloaded')
  })

  it('throws on invalid transitions', () => {
    const registry = new PluginRegistry()
    registry.register({ name: 'portal', version: '1.0.0' })
    const lifecycle = new PluginLifecycle(registry)

    expect(() => lifecycle.enable('portal')).toThrow('invalid lifecycle transition')
  })
})
