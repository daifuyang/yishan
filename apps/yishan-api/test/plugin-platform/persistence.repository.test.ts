import { describe, expect, it, vi } from 'vitest'
import { sysPlugin, sysPluginInstall, sysPluginVersion } from '../../src/db/schema'
import { PluginPersistenceRepository } from '../../src/core/plugin-platform/persistence'

function insertChain(terminal: ReturnType<typeof vi.fn>) {
  return {
    values: vi.fn(() => ({
      $returningId: terminal,
      onDuplicateKeyUpdate: terminal,
    })),
  }
}

function updateChain(terminal: ReturnType<typeof vi.fn>) {
  return {
    set: vi.fn(() => ({
      where: terminal,
    })),
  }
}

describe('PluginPersistenceRepository', () => {
  it('upserts manifest and install state', async () => {
    const sysPluginFindFirst = vi.fn().mockResolvedValue(null)
    const sysPluginInsertReturning = vi.fn().mockResolvedValue([{ id: 9 }])
    const sysPluginUpdateWhere = vi.fn().mockResolvedValue({})
    const sysPluginVersionUpsert = vi.fn().mockResolvedValue({})
    const sysPluginInstallUpsert = vi.fn().mockResolvedValue({})

    const client = {
      query: {
        sysPlugin: { findFirst: sysPluginFindFirst },
      },
      insert: vi.fn((table) => {
        if (table === sysPlugin) return insertChain(sysPluginInsertReturning)
        if (table === sysPluginVersion) return insertChain(sysPluginVersionUpsert)
        if (table === sysPluginInstall) return insertChain(sysPluginInstallUpsert)
        return insertChain(vi.fn().mockResolvedValue({}))
      }),
      update: vi.fn(() => updateChain(sysPluginUpdateWhere)),
    }

    const repository = new PluginPersistenceRepository(client as never)

    await repository.upsertManifest({
      pluginId: 'yishan/portal',
      name: 'portal',
      version: '1.0.0',
      coreCompatibility: '^1.0.0',
      routeBase: '/api/modules/@yishan/portal/v1'
    })

    expect(sysPluginInsertReturning).toHaveBeenCalledTimes(1)
    expect(sysPluginVersionUpsert).toHaveBeenCalledTimes(1)
    expect(sysPluginInstallUpsert).toHaveBeenCalledTimes(1)
  })

  it('updates runtime state by plugin id', async () => {
    const sysPluginFindFirst = vi.fn().mockResolvedValue({ id: 3 })
    const sysPluginUpdateWhere = vi.fn().mockResolvedValue({})
    const sysPluginInstallUpsert = vi.fn().mockResolvedValue({})

    const client = {
      query: {
        sysPlugin: { findFirst: sysPluginFindFirst },
      },
      update: vi.fn(() => updateChain(sysPluginUpdateWhere)),
      insert: vi.fn((table) => {
        if (table === sysPluginInstall) return insertChain(sysPluginInstallUpsert)
        return insertChain(vi.fn().mockResolvedValue({}))
      }),
    }

    const repository = new PluginPersistenceRepository(client as never)
    await repository.updateRuntimeState('yishan/hello', 'hello', 'enabled', true)

    expect(sysPluginFindFirst).toHaveBeenCalled()
    expect(sysPluginUpdateWhere).toHaveBeenCalledTimes(1)
    expect(sysPluginInstallUpsert).toHaveBeenCalledTimes(1)
  })
})
