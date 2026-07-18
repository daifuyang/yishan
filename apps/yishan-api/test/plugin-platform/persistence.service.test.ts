import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PluginPersistenceService } from '../../src/core/plugin-platform/persistence'

describe('PluginPersistenceService', () => {
  describe('listPluginStatesStrict()', () => {
    it('正常返回数据库状态，字段为 pluginId / enabled / updatedAt', async () => {
      const repository = {
        listRuntimeStates: vi.fn().mockResolvedValue([
          {
            pluginId: 'yishan/shop',
            name: 'shop',
            version: '1.0.0',
            lifecycleState: 'enabled',
            enabled: true,
            updatedAt: new Date('2024-01-01T00:00:00Z'),
          },
          {
            pluginId: 'yishan/portal',
            name: 'portal',
            version: '1.0.0',
            lifecycleState: 'enabled',
            enabled: false,
            updatedAt: new Date('2024-01-02T00:00:00Z'),
          },
        ]),
      }
      const warn = vi.fn()
      const service = new PluginPersistenceService(repository as never, { warn })

      const result = await service.listPluginStatesStrict()

      expect(result).toHaveLength(2)
      const shop = result.find(s => s.pluginId === 'yishan/shop')
      expect(shop?.enabled).toBe(true)
      expect(shop?.updatedAt).toBe('2024-01-01T00:00:00.000Z')
      const portal = result.find(s => s.pluginId === 'yishan/portal')
      expect(portal?.enabled).toBe(false)
    })

    it('数据库异常时拒绝降级，标记 degraded 后抛出错误', async () => {
      const repository = {
        listRuntimeStates: vi.fn().mockRejectedValue(new Error('db unavailable')),
      }
      const warn = vi.fn()
      const service = new PluginPersistenceService(repository as never, { warn })

      await expect(service.listPluginStatesStrict()).rejects.toThrow('db unavailable')
      expect(service.isDegraded()).toBe(true)
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'db unavailable' }),
        'strict plugin state read failed'
      )
    })

    it('降级的 listPluginStates() 不应被授权目录使用', async () => {
      // 验证 listPluginStates 在数据库失败时会 fallback 到内存
      const repository = {
        listRuntimeStates: vi.fn()
          .mockRejectedValueOnce(new Error('db unavailable'))
          .mockResolvedValue([
            {
              pluginId: 'yishan/shop',
              name: 'shop',
              version: '1.0.0',
              lifecycleState: 'enabled',
              enabled: true,
            },
          ]),
      }
      const warn = vi.fn()
      const service = new PluginPersistenceService(repository as never, { warn })

      // 第一次调用 strict 应该抛错
      await expect(service.listPluginStatesStrict()).rejects.toThrow('db unavailable')

      // 第二次调用（DB 恢复），strict 应该正常工作
      const result = await service.listPluginStatesStrict()
      expect(result).toHaveLength(1)
      expect(result[0].pluginId).toBe('yishan/shop')
    })
  })

  describe('listPluginStates() (降级 reader，仅用于管理页展示)', () => {
    it('数据库失败时降级返回内存状态，不抛出异常', async () => {
      const repository = {
        listRuntimeStates: vi.fn().mockRejectedValue(new Error('db unavailable')),
      }
      const warn = vi.fn()
      const service = new PluginPersistenceService(repository as never, { warn })

      // 先写入内存状态
      await service.syncManifest({ pluginId: 'yishan/portal', name: 'portal', version: '1.0.0' })
      await service.updateRuntimeState('yishan/portal', 'portal', 'enabled', true)

      // 降级 reader 应该不抛错，返回内存数据
      const result = await service.listPluginStates()
      expect(result).toHaveLength(1)
      expect(result[0].pluginId).toBe('yishan/portal')
      expect(result[0].enabled).toBe(true)
      expect(service.isDegraded()).toBe(true)
    })
  })

  describe('updateRuntimeStateStrict()', () => {
    it('数据库写入成功后允许更新内存视图', async () => {
      const updateRuntimeState = vi.fn().mockResolvedValue(undefined)
      const repository = {
        updateRuntimeState,
      }
      const service = new PluginPersistenceService(repository as never)

      // 预热内存状态（模拟 syncManifest 已写过）
      await service.syncManifest({ pluginId: 'yishan/shop', name: 'shop', version: '1.0.0' })

      await service.updateRuntimeStateStrict('yishan/shop', 'shop', 'enabled', true)

      expect(updateRuntimeState).toHaveBeenCalledWith('yishan/shop', 'shop', 'enabled', true, undefined)
      // 内存视图也应反映持久化结果
      expect(service.getMemoryRecord('yishan/shop')?.enabled).toBe(true)
      expect(service.getMemoryRecord('yishan/shop')?.lifecycleState).toBe('enabled')
    })

    it('数据库写失败时抛错，绝不更新内存视图', async () => {
      const dbError = new Error('db write failed')
      const updateRuntimeState = vi.fn().mockRejectedValue(dbError)
      const warn = vi.fn()
      const repository = {
        updateRuntimeState,
      }
      const service = new PluginPersistenceService(repository as never, { warn })

      await service.syncManifest({ pluginId: 'yishan/shop', name: 'shop', version: '1.0.0' })

      await expect(
        service.updateRuntimeStateStrict('yishan/shop', 'shop', 'enabled', true)
      ).rejects.toThrow('db write failed')

      // 失败后内存状态不得伪装为已持久化（保持 syncManifest 的初始值 enabled=false / discovered）
      const memory = service.getMemoryRecord('yishan/shop')
      expect(memory?.enabled).toBe(false)
      expect(memory?.lifecycleState).toBe('discovered')

      expect(service.isDegraded()).toBe(true)
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'db write failed' }),
        'strict plugin runtime state write failed'
      )
    })

    it('throws 为原始 DB 错误对象，供上层做精确分类', async () => {
      const originalError = new Error('connection reset')
      originalError.name = 'ECONNRESET'
      const repository = {
        updateRuntimeState: vi.fn().mockRejectedValue(originalError),
      }
      const service = new PluginPersistenceService(repository as never)

      try {
        await service.updateRuntimeStateStrict('yishan/shop', 'shop', 'enabled', true)
        expect.fail('should not reach')
      } catch (err) {
        expect(err).toBe(originalError)
      }
    })
  })

  describe('getRuntimeStateStrict()', () => {
    it('直接返回 DB 记录，不读 memory fallback', async () => {
      const dbRecord = {
        pluginId: 'yishan/shop',
        name: 'shop',
        version: '1.0.0',
        lifecycleState: 'enabled' as const,
        enabled: true,
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      }
      const getRuntimeState = vi.fn().mockResolvedValue(dbRecord)
      const repository = { getRuntimeState }
      const service = new PluginPersistenceService(repository as never)

      // 同步一个状态不同的内存记录
      await service.syncManifest({ pluginId: 'yishan/shop', name: 'shop', version: '1.0.0' })

      const result = await service.getRuntimeStateStrict('yishan/shop')
      expect(result).toEqual(dbRecord)
      expect(result?.enabled).toBe(true)
    })

    it('数据库无记录时返回 null（不伪装为 enabled）', async () => {
      const repository = {
        getRuntimeState: vi.fn().mockResolvedValue(null),
      }
      const service = new PluginPersistenceService(repository as never)

      const result = await service.getRuntimeStateStrict('yishan/new-plugin')
      expect(result).toBeNull()
    })

    it('数据库异常时抛错，不返回 memory fallback', async () => {
      const getRuntimeState = vi.fn().mockRejectedValue(new Error('db unavailable'))
      const warn = vi.fn()
      const repository = { getRuntimeState }
      const service = new PluginPersistenceService(repository as never, { warn })

      // 同步一个内存记录，strict reader 不得返回该内存值
      await service.syncManifest({ pluginId: 'yishan/shop', name: 'shop', version: '1.0.0' })
      await service.updateRuntimeState('yishan/shop', 'shop', 'enabled', true)

      await expect(service.getRuntimeStateStrict('yishan/shop')).rejects.toThrow('db unavailable')
      expect(service.isDegraded()).toBe(true)
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'db unavailable' }),
        'strict plugin state single read failed'
      )
    })
  })

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
