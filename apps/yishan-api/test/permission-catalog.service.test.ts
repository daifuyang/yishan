import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  PermissionCatalogService,
  ManifestReader,
  CatalogNotInitializedError,
  PermissionConflictError,
  getGlobalCatalog,
} from '@/core/services/permission-catalog.service'
import { BusinessError } from '@/exceptions/business-error'
import { ValidationErrorCode } from '@/constants/business-codes/validation'

describe('PermissionCatalogService', () => {
  let mockStateReader: () => Promise<{ pluginId: string; enabled: boolean; updatedAt: string | null }[]>
  let mockManifestReader: ManifestReader

  /**
   * 创建 mock state reader，返回插件状态快照数组。
   */
  const createMockStateReader = (enabledPlugins: string[]) => {
    return vi.fn().mockResolvedValue(
      enabledPlugins.map(id => ({ pluginId: id, enabled: true, updatedAt: null }))
    )
  }

  const createMockManifestReader = (manifests: any[]) => ({
    listManifests: () => manifests,
  })

  beforeEach(() => {
    mockStateReader = createMockStateReader([])
    mockManifestReader = createMockManifestReader([])
    vi.clearAllMocks()
  })

  describe('未初始化时访问', () => {
    it('getActiveCatalog() 未初始化时抛出 CatalogNotInitializedError', async () => {
      const catalog = new PermissionCatalogService()
      await expect(catalog.getActiveCatalog()).rejects.toThrow(CatalogNotInitializedError)
    })

    it('getActiveCodes() 未初始化时抛出 CatalogNotInitializedError', async () => {
      const catalog = new PermissionCatalogService()
      await expect(catalog.getActiveCodes()).rejects.toThrow(CatalogNotInitializedError)
    })

    it('hasActiveCode() 未初始化时抛出 CatalogNotInitializedError', async () => {
      const catalog = new PermissionCatalogService()
      await expect(catalog.hasActiveCode('any:code')).rejects.toThrow(CatalogNotInitializedError)
    })

    it('isInitialized() 未初始化时返回 false', () => {
      const catalog = new PermissionCatalogService()
      expect(catalog.isInitialized()).toBe(false)
    })
  })

  describe('init() 方法', () => {
    it('成功初始化后 isInitialized() 返回 true', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()
      expect(catalog.isInitialized()).toBe(true)
    })

    it('初始化后 getActiveCatalog() 返回目录项', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()
      const items = await catalog.getActiveCatalog()
      // Core 权限应该存在
      expect(items.length).toBeGreaterThan(0)
      expect(items.some(i => i.source === 'core')).toBe(true)
    })

    it('只包含启用的插件权限', async () => {
      mockStateReader = createMockStateReader(['yishan/hello'])
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/hello',
          permissions: [{ code: 'hello:read', label: '读取', group: 'hello' }],
        },
        {
          pluginId: 'yishan/portal',
          permissions: [{ code: 'portal:read', label: '读取', group: 'portal' }],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const codes = await catalog.getActiveCodes()
      expect(codes.has('hello:read')).toBe(true)
      expect(codes.has('portal:read')).toBe(false) // portal 未启用
    })

    it('禁用插件后其权限不出现在目录中', async () => {
      mockStateReader = createMockStateReader([]) // 无启用的插件
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/shop',
          permissions: [{ code: 'shop:read', label: '读取', group: 'shop' }],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const codes = await catalog.getActiveCodes()
      expect(codes.has('shop:read')).toBe(false)
    })
  })

  describe('权限来源标记', () => {
    it('Core 权限标记 source 为 "core"', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const items = await catalog.getActiveCatalog()
      const coreItems = items.filter(i => i.source === 'core')
      expect(coreItems.length).toBeGreaterThan(0)
    })

    it('插件权限标记 source 为 pluginId', async () => {
      mockStateReader = createMockStateReader(['yishan/hello'])
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/hello',
          permissions: [{ code: 'hello:read', label: '读取', group: 'hello' }],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const items = await catalog.getActiveCatalog()
      const helloItems = items.filter(i => i.source === 'yishan/hello')
      expect(helloItems.length).toBe(1)
      expect(helloItems[0].code).toBe('hello:read')
    })
  })

  describe('Core 权限不含 shop/portal/hello', () => {
    it('Core Definitions 不含 shop: 前缀', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const items = await catalog.getActiveCatalog()
      const coreCodes = items
        .filter(i => i.source === 'core')
        .map(i => i.code)
      expect(coreCodes.some(c => c.startsWith('shop:'))).toBe(false)
    })

    it('Core Definitions 不含 portal: 前缀', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const items = await catalog.getActiveCatalog()
      const coreCodes = items
        .filter(i => i.source === 'core')
        .map(i => i.code)
      expect(coreCodes.some(c => c.startsWith('portal:'))).toBe(false)
    })

    it('Core Definitions 不含 hello: 前缀', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const items = await catalog.getActiveCatalog()
      const coreCodes = items
        .filter(i => i.source === 'core')
        .map(i => i.code)
      expect(coreCodes.some(c => c.startsWith('hello:'))).toBe(false)
    })
  })

  describe('插件启用后权限添加', () => {
    it('shop enabled 后 Catalog 包含 shop manifest 权限且来源是 yishan/shop', async () => {
      mockStateReader = createMockStateReader(['yishan/shop'])
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/shop',
          permissions: [
            { code: 'shop:product:list', label: '商品列表', group: 'shop' },
            { code: 'shop:product:create', label: '商品创建', group: 'shop' },
          ],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const items = await catalog.getActiveCatalog()
      const shopItems = items.filter(i => i.source === 'yishan/shop')
      expect(shopItems.length).toBe(2)
      expect(shopItems.some(i => i.code === 'shop:product:list')).toBe(true)
      expect(shopItems.some(i => i.code === 'shop:product:create')).toBe(true)
    })

    it('portal enabled 后 Catalog 包含 portal manifest 权限且来源是 yishan/portal', async () => {
      mockStateReader = createMockStateReader(['yishan/portal'])
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/portal',
          permissions: [
            { code: 'portal:article:list', label: '文章列表', group: 'portal' },
          ],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const items = await catalog.getActiveCatalog()
      const portalItems = items.filter(i => i.source === 'yishan/portal')
      expect(portalItems.length).toBe(1)
      expect(portalItems[0].code).toBe('portal:article:list')
    })
  })

  describe('权限冲突检测', () => {
    it('同一 code 同时来自 Core 和 enabled plugin 时 init() 抛 PermissionConflictError', async () => {
      mockStateReader = createMockStateReader(['yishan/plugin-a'])
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/plugin-a',
          permissions: [
            // plugin 声明了一个 system: 前缀的 code，与 Core 冲突
            { code: 'system:dashboard:read', label: '仪表盘读取', group: 'system' },
          ],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await expect(catalog.init()).rejects.toThrow(PermissionConflictError)
    })

    it('两个 enabled plugin 声明相同 code 时 init() 抛 PermissionConflictError', async () => {
      mockStateReader = createMockStateReader(['yishan/plugin-a', 'yishan/plugin-b'])
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/plugin-a',
          permissions: [
            { code: 'shared:code', label: '共享权限A', group: 'plugin-a' },
          ],
        },
        {
          pluginId: 'yishan/plugin-b',
          permissions: [
            { code: 'shared:code', label: '共享权限B', group: 'plugin-b' },
          ],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await expect(catalog.init()).rejects.toThrow(PermissionConflictError)
    })

    it('shop/portal/hello 全 enabled 时无重复 code，初始化成功', async () => {
      mockStateReader = createMockStateReader(['yishan/shop', 'yishan/portal', 'yishan/hello'])
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/shop',
          permissions: [
            { code: 'shop:product:list', label: '商品列表', group: 'shop' },
          ],
        },
        {
          pluginId: 'yishan/portal',
          permissions: [
            { code: 'portal:article:list', label: '文章列表', group: 'portal' },
          ],
        },
        {
          pluginId: 'yishan/hello',
          permissions: [
            { code: 'hello:read', label: '读取', group: 'hello' },
          ],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await expect(catalog.init()).resolves.not.toThrow()

      const codes = await catalog.getActiveCodes()
      expect(codes.has('shop:product:list')).toBe(true)
      expect(codes.has('portal:article:list')).toBe(true)
      expect(codes.has('hello:read')).toBe(true)
    })
  })

  describe('refresh-on-read 模式', () => {
    it('snapshot 变化时自动重建目录', async () => {
      // 使用可变引用
      const snapshots = [
        { pluginId: 'yishan/shop', enabled: true, updatedAt: '2024-01-01T00:00:00Z' },
      ]

      const reader = async () => {
        // 每次调用返回当前的 snapshots
        return [...snapshots]
      }

      const manifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/shop',
          permissions: [{ code: 'shop:product:list', label: '商品列表', group: 'shop' }],
        },
      ])

      const catalog = new PermissionCatalogService(reader, manifestReader)
      await catalog.init()

      // 第一次调用，shop enabled
      let codes = await catalog.getActiveCodes()
      expect(codes.has('shop:product:list')).toBe(true)

      // 修改 snapshot 使 shop disabled
      snapshots[0] = { pluginId: 'yishan/shop', enabled: false, updatedAt: '2024-01-02T00:00:00Z' }

      // 第二次调用，shop disabled（snapshot 变化触发重建）
      codes = await catalog.getActiveCodes()
      expect(codes.has('shop:product:list')).toBe(false)
    })

    it('disabled 插件重新 enabled 后目录恢复', async () => {
      // 使用可变引用
      const snapshots = [
        { pluginId: 'yishan/shop', enabled: false, updatedAt: '2024-01-01T00:00:00Z' },
      ]

      const reader = async () => {
        return [...snapshots]
      }

      const manifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/shop',
          permissions: [{ code: 'shop:product:list', label: '商品列表', group: 'shop' }],
        },
      ])

      const catalog = new PermissionCatalogService(reader, manifestReader)
      await catalog.init()

      // 初始状态 shop disabled
      let codes = await catalog.getActiveCodes()
      expect(codes.has('shop:product:list')).toBe(false)

      // 修改 snapshot 使 shop enabled
      snapshots[0] = { pluginId: 'yishan/shop', enabled: true, updatedAt: '2024-01-02T00:00:00Z' }

      // 重新 enabled
      codes = await catalog.getActiveCodes()
      expect(codes.has('shop:product:list')).toBe(true)
    })

    it('snapshot 读取失败时 fail closed，拒绝授权', async () => {
      let shouldFail = false
      const reader = async () => {
        if (shouldFail) {
          throw new Error('Database connection failed')
        }
        return []
      }

      // 先用成功的 reader 初始化
      const catalog = new PermissionCatalogService(reader, createMockManifestReader([]))
      await catalog.init()

      // 初始状态应该有缓存，可以正常获取
      const codes1 = await catalog.getActiveCodes()
      expect(codes1.size).toBeGreaterThan(0)

      // 模拟数据库连接失败
      shouldFail = true

      // 下一次 getActiveCodes 调用应该抛出业务错误，不能返回旧缓存
      await expect(catalog.getActiveCodes()).rejects.toThrow()
    })
  })

  describe('strict reader 故障回归（fail closed，禁止返回旧缓存）', () => {
    it('init 接到 reject reader 时直接 reject，且 isInitialized() 为 false', async () => {
      const reader = vi.fn(async () => {
        throw new Error('db unavailable')
      })
      const catalog = new PermissionCatalogService(reader, createMockManifestReader([]))

      await expect(catalog.init()).rejects.toThrow()
      expect(catalog.isInitialized()).toBe(false)

      // 后续 getActiveCodes / getActiveCatalog 也必须 fail closed
      await expect(catalog.getActiveCodes()).rejects.toBeInstanceOf(BusinessError)
      await expect(catalog.getActiveCatalog()).rejects.toBeInstanceOf(BusinessError)
    })

    it('init reject 后错误必须是 BusinessError / INVALID_STATE，不泄露原始 db 错误', async () => {
      const dbError = new Error('connection reset')
      const reader = vi.fn(async () => {
        throw dbError
      })
      const catalog = new PermissionCatalogService(reader, createMockManifestReader([]))

      try {
        await catalog.init()
        expect.fail('should not reach')
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessError)
        const be = err as BusinessError
        expect(be.code).toBe(21009) // ValidationErrorCode.INVALID_STATE
        // 错误消息描述 Catalog 状态而非数据库细节
        expect(be.message).toContain('无法读取插件权限目录状态')
        // 原始 db 错误不应作为 error 对象的 .cause 等方式泄露到客户端码
        // （catalog 不应在 message 中出现 db 错误详情）
        expect(be.message).not.toContain('connection reset')
      }
    })

    it('先成功 init，再切换 reader 为 reject：getActiveCodes 必须 reject，不能返回上一次缓存', async () => {
      let shouldFail = false
      const reader = vi.fn(async () => {
        if (shouldFail) {
          throw new Error('Database read timeout')
        }
        return [{ pluginId: 'yishan/shop', enabled: true, updatedAt: '2024-01-01T00:00:00Z' }]
      })
      const manifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/shop',
          permissions: [{ code: 'shop:product:list', label: '商品列表', group: 'shop' }],
        },
      ])
      const catalog = new PermissionCatalogService(reader, manifestReader)
      await catalog.init()
      const cached = await catalog.getActiveCodes()
      expect(cached.has('shop:product:list')).toBe(true)

      // 切换为失败 reader：必须 reject，绝不能返回上一次缓存
      shouldFail = true
      let rejected = false
      try {
        await catalog.getActiveCodes()
      } catch (err) {
        rejected = true
        expect(err).toBeInstanceOf(BusinessError)
        expect((err as BusinessError).code).toBe(21009) // INVALID_STATE
      }
      expect(rejected).toBe(true)

      // 同样 getActiveCatalog 必须 reject
      await expect(catalog.getActiveCatalog()).rejects.toBeInstanceOf(BusinessError)
    })

    it('reader 抛错的循环里，每次调用都必须 reject，而不是有一次 reject 后就持续 throw', async () => {
      let fail = false
      const reader = vi.fn(async () => {
        if (fail) {
          throw new Error('db unavailable')
        }
        return []
      })
      const catalog = new PermissionCatalogService(reader, createMockManifestReader([]))
      await catalog.init()

      // 先确认一次成功调用（Core 权限应能拿到）
      await catalog.getActiveCodes()

      // 进入失败态
      fail = true
      await expect(catalog.getActiveCodes()).rejects.toBeInstanceOf(BusinessError)

      // 再次调用仍必须 reject（不允许缓存泄露）
      await expect(catalog.getActiveCodes()).rejects.toBeInstanceOf(BusinessError)
      // reader 仍被调用（refresh on read）
      expect(reader.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('invalidate() 方法', () => {
    it('失效后 isInitialized() 返回 false', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()
      expect(catalog.isInitialized()).toBe(true)

      catalog.invalidate()
      expect(catalog.isInitialized()).toBe(false)
    })

    it('失效后访问抛出 CatalogNotInitializedError', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()
      catalog.invalidate()

      await expect(catalog.getActiveCatalog()).rejects.toThrow(CatalogNotInitializedError)
      await expect(catalog.getActiveCodes()).rejects.toThrow(CatalogNotInitializedError)
    })
  })

  describe('辅助方法', () => {
    it('hasActiveCode() 正确判断权限是否存在', async () => {
      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      // Core 权限存在
      const hasDashboardRead = await catalog.hasActiveCode('system:dashboard:read')
      expect(hasDashboardRead).toBe(true)

      // 不存在的权限
      const hasNonExistent = await catalog.hasActiveCode('nonexistent:code')
      expect(hasNonExistent).toBe(false)
    })

    it('getVersion() 返回缓存版本 key', async () => {
      mockStateReader = createMockStateReader(['yishan/hello'])
      mockManifestReader = createMockManifestReader([])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const version = catalog.getVersion()
      expect(typeof version).toBe('string')
      expect(version.length).toBeGreaterThan(0)
    })

    it('getGroups() 返回所有 group 列表', async () => {
      mockStateReader = createMockStateReader(['yishan/hello'])
      mockManifestReader = createMockManifestReader([
        {
          pluginId: 'yishan/hello',
          permissions: [{ code: 'hello:read', label: '读取', group: 'hello' }],
        },
      ])

      const catalog = new PermissionCatalogService(mockStateReader, mockManifestReader)
      await catalog.init()

      const groups = await catalog.getGroups()
      expect(groups).toContain('system') // Core 权限的 group
      expect(groups).toContain('hello')
    })
  })

  describe('getGlobalCatalog() 全局单例', () => {
    it('初始化后可以获取全局 catalog', async () => {
      const catalog = getGlobalCatalog()
      expect(catalog.isInitialized()).toBe(true)
      const items = await catalog.getActiveCatalog()
      expect(items).toBeDefined()
    })
  })
})
