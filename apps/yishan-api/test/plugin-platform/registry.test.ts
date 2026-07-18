import { describe, expect, it } from 'vitest'
import { PluginRegistry } from '../../src/core/plugin-platform/registry'

describe('PluginRegistry', () => {
  it('supports register/list/get', () => {
    const registry = new PluginRegistry()
    registry.register({ name: 'hello', version: '1.0.0' })
    registry.register({ name: 'portal', version: '1.0.0' }, 'loaded')

    expect(registry.get('hello')?.manifest.name).toBe('hello')
    expect(registry.get('portal')?.state).toBe('loaded')
    expect(registry.list().map((item) => item.manifest.name)).toEqual(['hello', 'portal'])
  })
})
