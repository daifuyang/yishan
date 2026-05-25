import { describe, expect, it, vi } from 'vitest'
import { PluginPersistenceService } from '../../src/plugins-runtime/persistence'

describe('PluginPersistenceService', () => {
  it('degrades gracefully when persistence fails', async () => {
    const repository = {
      upsertManifest: vi.fn().mockRejectedValue(new Error('db unavailable')),
      updateRuntimeState: vi.fn().mockRejectedValue(new Error('db unavailable'))
    }
    const warn = vi.fn()
    const service = new PluginPersistenceService(repository as never, { warn })

    await service.syncManifest({ pluginId: 'yishan/portal', name: 'portal', version: '1.0.0' })
    await service.updateRuntimeState('yishan/portal', 'portal', 'enabled', true)

    expect(service.isDegraded()).toBe(true)
    expect(service.getMemoryRecord('yishan/portal')?.enabled).toBe(true)
    expect(warn).toHaveBeenCalled()
  })
})
