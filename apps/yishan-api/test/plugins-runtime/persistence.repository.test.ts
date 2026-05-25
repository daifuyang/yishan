import { describe, expect, it, vi } from 'vitest'
import { PluginPersistenceRepository } from '../../src/plugins-runtime/persistence'

describe('PluginPersistenceRepository', () => {
  it('upserts manifest and install state', async () => {
    const sysPluginFindFirst = vi.fn().mockResolvedValue(null)
    const sysPluginCreate = vi.fn().mockResolvedValue({ id: 9 })
    const sysPluginUpdate = vi.fn().mockResolvedValue({})
    const sysPluginVersionUpsert = vi.fn().mockResolvedValue({})
    const sysPluginInstallUpsert = vi.fn().mockResolvedValue({})

    const client = {
      sysPlugin: { findFirst: sysPluginFindFirst, create: sysPluginCreate, update: sysPluginUpdate },
      sysPluginVersion: { upsert: sysPluginVersionUpsert },
      sysPluginInstall: { upsert: sysPluginInstallUpsert }
    }

    const repository = new PluginPersistenceRepository(client as never)

    await repository.upsertManifest({
      pluginId: 'yishan/portal',
      name: 'portal',
      version: '1.0.0',
      coreCompatibility: '^1.0.0',
      routeBase: '/api/modules/@yishan/portal/v1'
    })

    expect(sysPluginCreate).toHaveBeenCalledTimes(1)
    expect(sysPluginVersionUpsert).toHaveBeenCalledTimes(1)
    expect(sysPluginInstallUpsert).toHaveBeenCalledTimes(1)
  })

  it('updates runtime state by plugin id', async () => {
    const sysPluginFindFirst = vi.fn().mockResolvedValue({ id: 3 })
    const sysPluginUpdate = vi.fn().mockResolvedValue({})
    const sysPluginInstallUpsert = vi.fn().mockResolvedValue({})

    const client = {
      sysPlugin: { findFirst: sysPluginFindFirst, update: sysPluginUpdate },
      sysPluginVersion: { upsert: vi.fn() },
      sysPluginInstall: { upsert: sysPluginInstallUpsert }
    }

    const repository = new PluginPersistenceRepository(client as never)
    await repository.updateRuntimeState('yishan/hello', 'hello', 'enabled', true)

    expect(sysPluginFindFirst).toHaveBeenCalled()
    expect(sysPluginUpdate).toHaveBeenCalledTimes(1)
    expect(sysPluginInstallUpsert).toHaveBeenCalledTimes(1)
  })
})
