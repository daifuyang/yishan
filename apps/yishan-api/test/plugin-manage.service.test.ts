import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPluginRuntime } from '../src/core/plugin-platform/index.js'
import { PluginManageService } from '../src/core/services/plugin-manage.service.js'
import type { PluginRuntime } from '../src/core/plugin-platform/index.js'
import type { PersistedPluginRuntimeState } from '../src/core/plugin-platform/persistence.js'

const pluginId = 'test/shop'
const pluginName = 'shop'

function record(enabled: boolean): PersistedPluginRuntimeState {
  return {
    pluginId,
    name: pluginName,
    version: '1.0.0',
    lifecycleState: enabled ? 'enabled' : 'disabled',
    enabled,
  }
}

function buildRuntime(initialEnabled: boolean) {
  const runtime = createPluginRuntime() as PluginRuntime & { persistence: any }
  runtime.register({
    pluginId,
    name: pluginName,
    version: '1.0.0',
    dbNamespace: 'ys_shop',
    permissions: [],
    menus: [],
  })
  runtime.lifecycle.load(pluginName)
  if (initialEnabled) runtime.lifecycle.enable(pluginName)
  else runtime.lifecycle.disable(pluginName)

  const persistence = {
    getRuntimeStateStrict: vi.fn().mockResolvedValue(record(initialEnabled)),
    updateRuntimeStateStrict: vi.fn().mockResolvedValue(undefined),
    // 使启停流程在 Catalog 重建处失败，从而进入补偿路径。
    listPluginStatesStrict: vi.fn().mockRejectedValue(new Error('catalog db unavailable')),
    getRuntimeState: vi.fn().mockResolvedValue(record(initialEnabled)),
    listRuntimeStates: vi.fn().mockResolvedValue([record(initialEnabled)]),
  }
  runtime.persistence = persistence
  return { runtime, persistence }
}

describe('PluginManageService strict state transitions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('启用后 Catalog 重建失败：恢复写入前保存的 disabled 原状态', async () => {
    const { runtime, persistence } = buildRuntime(false)
    const logger = { error: vi.fn(), warn: vi.fn() }
    const service = new PluginManageService(runtime, logger)

    await expect(service.enablePlugin(pluginName)).rejects.toThrow('无法读取插件权限目录状态')

    // 首次严格读取发生在写 enabled 之前；补偿不应再重新读取“原状态”。
    expect(persistence.getRuntimeStateStrict).toHaveBeenCalledTimes(1)
    expect(persistence.updateRuntimeStateStrict.mock.calls).toEqual([
      [pluginId, pluginName, 'enabled', true],
      [pluginId, pluginName, 'disabled', false],
    ])
    expect(runtime.registry.get(pluginName)?.state).toBe('disabled')
  })

  it('禁用后 Catalog 重建失败：恢复写入前保存的 enabled 原状态', async () => {
    const { runtime, persistence } = buildRuntime(true)
    const logger = { error: vi.fn(), warn: vi.fn() }
    const service = new PluginManageService(runtime, logger)

    await expect(service.disablePlugin(pluginName)).rejects.toThrow('无法读取插件权限目录状态')

    expect(persistence.getRuntimeStateStrict).toHaveBeenCalledTimes(1)
    expect(persistence.updateRuntimeStateStrict.mock.calls).toEqual([
      [pluginId, pluginName, 'disabled', false],
      [pluginId, pluginName, 'enabled', true],
    ])
    expect(runtime.registry.get(pluginName)?.state).toBe('enabled')
  })

  it('启用的严格写入失败：不执行 runtime 副作用或 Catalog 重建', async () => {
    const { runtime, persistence } = buildRuntime(false)
    persistence.updateRuntimeStateStrict.mockRejectedValueOnce(new Error('write unavailable'))
    const service = new PluginManageService(runtime, { error: vi.fn(), warn: vi.fn() })

    await expect(service.enablePlugin(pluginName)).rejects.toThrow('write unavailable')

    expect(runtime.registry.get(pluginName)?.state).toBe('disabled')
    expect(persistence.listPluginStatesStrict).not.toHaveBeenCalled()
    expect(persistence.updateRuntimeStateStrict).toHaveBeenCalledTimes(1)
  })

  it('同步菜单前严格读取失败：不使用 memory fallback，也不改变 runtime 状态', async () => {
    const { runtime, persistence } = buildRuntime(true)
    persistence.getRuntimeStateStrict.mockRejectedValueOnce(new Error('read unavailable'))
    const service = new PluginManageService(runtime, { error: vi.fn(), warn: vi.fn() })

    await expect(service.syncPlugin(pluginName)).rejects.toThrow('read unavailable')

    expect(persistence.getRuntimeState).not.toHaveBeenCalled()
    expect(runtime.registry.get(pluginName)?.state).toBe('enabled')
    expect(persistence.listPluginStatesStrict).not.toHaveBeenCalled()
  })
})
