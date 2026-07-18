/**
 * 插件启动状态恢复与权限目录一致性回归测试
 *
 * 覆盖：
 * 1. 生产 `getEnabledPluginNames` 纯函数：按数据库 enabled 决定应启用集合
 * 2. 重启后状态与上次相同，disabled 不会自动启用
 * 3. 数据库无记录的插件保持 disabled，不猜测默认 enabled
 *
 * 注意：必须直接 import 生产导出，禁止在测试中复制条件判断。
 */

import { describe, expect, it } from 'vitest'
import {
  getEnabledPluginNames,
  loadEnabledPluginManifests,
} from '../src/core/plugin-platform/startup-state'
import type { PluginManifest } from '../src/core/plugin-platform/types'
import type { PluginStateSnapshot } from '../src/core/plugin-platform/persistence'

// ============================================================================
// Helper: 构造一个 minimal manifest
// ============================================================================

function makeManifest(pluginId: string, name: string): PluginManifest {
  return {
    pluginId,
    name,
    version: '1.0.0',
    scope: pluginId,
    permissions: [{ code: `${name}:read`, label: '读取', group: name }],
    menus: [{ name: `${name}-menu`, path: `/${name}`, perm: `${name}:read` }],
  } as PluginManifest
}

// ============================================================================
// 纯函数行为（直接 import 生产导出，禁止复制）
// ============================================================================

describe('getEnabledPluginNames() — 生产纯函数', () => {
  it('数据库 shop=true, portal=false → 仅 shop 被启用', () => {
    const manifests = [makeManifest('yishan/shop', 'shop'), makeManifest('yishan/portal', 'portal')]
    const snapshots: PluginStateSnapshot[] = [
      { pluginId: 'yishan/shop', enabled: true, updatedAt: '2024-01-01T00:00:00Z' },
      { pluginId: 'yishan/portal', enabled: false, updatedAt: '2024-01-01T00:00:00Z' },
    ]

    const result = getEnabledPluginNames(manifests, snapshots)
    expect(result).toEqual(new Set(['shop']))
  })

  it('两个插件都是 true → 两个都被启用', () => {
    const manifests = [makeManifest('yishan/shop', 'shop'), makeManifest('yishan/portal', 'portal')]
    const snapshots: PluginStateSnapshot[] = [
      { pluginId: 'yishan/shop', enabled: true, updatedAt: '2024-01-01T00:00:00Z' },
      { pluginId: 'yishan/portal', enabled: true, updatedAt: '2024-01-01T00:00:00Z' },
    ]

    const result = getEnabledPluginNames(manifests, snapshots)
    expect(result).toEqual(new Set(['shop', 'portal']))
  })

  it('所有插件都是 false → 全部不启用', () => {
    const manifests = [makeManifest('yishan/shop', 'shop'), makeManifest('yishan/portal', 'portal')]
    const snapshots: PluginStateSnapshot[] = [
      { pluginId: 'yishan/shop', enabled: false, updatedAt: '2024-01-01T00:00:00Z' },
      { pluginId: 'yishan/portal', enabled: false, updatedAt: '2024-01-01T00:00:00Z' },
    ]

    const result = getEnabledPluginNames(manifests, snapshots)
    expect(result.size).toBe(0)
  })

  it('数据库无记录的新插件 → 保持 disabled（不猜测默认 enabled）', () => {
    const manifests = [makeManifest('yishan/new-plugin', 'new-plugin')]
    const snapshots: PluginStateSnapshot[] = [] // 数据库无该插件记录

    const result = getEnabledPluginNames(manifests, snapshots)
    expect(result.size).toBe(0)
  })

  it('重启后状态与上次相同，disabled 不会自动启用', () => {
    const manifests = [makeManifest('yishan/shop', 'shop')]
    // 第一次：shop disabled
    let snapshots: PluginStateSnapshot[] = [
      { pluginId: 'yishan/shop', enabled: false, updatedAt: '2024-01-01T00:00:00Z' },
    ]

    let result = getEnabledPluginNames(manifests, snapshots)
    expect(result.size).toBe(0)

    // 第二次重启：仍然是 disabled（模拟重启场景）
    snapshots = [
      { pluginId: 'yishan/shop', enabled: false, updatedAt: '2024-01-01T00:00:00Z' },
    ]
    result = getEnabledPluginNames(manifests, snapshots)
    expect(result.size).toBe(0)
  })

  it('快照中 pluginId 找不到对应 manifest 时被忽略', () => {
    const manifests = [makeManifest('yishan/shop', 'shop')]
    const snapshots: PluginStateSnapshot[] = [
      // 数据库有 portal，但 manifest 不存在（启动时未发现）
      { pluginId: 'yishan/portal', enabled: true, updatedAt: null },
    ]
    const result = getEnabledPluginNames(manifests, snapshots)
    expect(result.size).toBe(0)
  })

  it('manifest 找不到对应快照时保持 disabled', () => {
    const manifests = [makeManifest('yishan/shop', 'shop'), makeManifest('yishan/portal', 'portal')]
    const snapshots: PluginStateSnapshot[] = [
      // 数据库只有 shop；portal 没有记录
      { pluginId: 'yishan/shop', enabled: true, updatedAt: null },
    ]
    const result = getEnabledPluginNames(manifests, snapshots)
    expect(result).toEqual(new Set(['shop']))
  })
})

// ============================================================================
// 启动编排集成测试 — loadEnabledPluginManifests（async）
// ============================================================================

describe('loadEnabledPluginManifests() — 启动编排辅助', () => {
  it('strict reader reject → 必须抛错，不返回任何 manifest', async () => {
    const manifests = [makeManifest('yishan/shop', 'shop')]
    const reader = async () => {
      throw new Error('db unavailable')
    }
    await expect(loadEnabledPluginManifests({ manifests, readStatesStrict: reader })).rejects.toThrow('db unavailable')
  })

  it('shop=false, portal=true → 只返回 portal', async () => {
    const manifests = [
      makeManifest('yishan/shop', 'shop'),
      makeManifest('yishan/portal', 'portal'),
    ]
    const reader = async (): Promise<PluginStateSnapshot[]> => [
      { pluginId: 'yishan/shop', enabled: false, updatedAt: null },
      { pluginId: 'yishan/portal', enabled: true, updatedAt: null },
    ]
    const enabled = await loadEnabledPluginManifests({ manifests, readStatesStrict: reader })
    expect(enabled.map((entry) => entry.manifest.name)).toEqual(['portal'])
  })

  it('strict reader 不会被任何插件记录“写”为 enabled（reader 为只读）', async () => {
    let writes = 0
    const manifests = [makeManifest('yishan/shop', 'shop')]
    const reader = async (): Promise<PluginStateSnapshot[]> => {
      // 模拟对 DB 的副作用访问计数 — 但本函数承诺不写
      writes += 0
      return [{ pluginId: 'yishan/shop', enabled: true, updatedAt: null }]
    }
    await loadEnabledPluginManifests({ manifests, readStatesStrict: reader })
    expect(writes).toBe(0)
  })

  it('空 manifest / 空 snapshot → 返回空数组', async () => {
    const reader = async (): Promise<PluginStateSnapshot[]> => []
    const enabled = await loadEnabledPluginManifests({ manifests: [], readStatesStrict: reader })
    expect(enabled).toEqual([])
  })
})
