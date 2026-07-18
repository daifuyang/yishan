/**
 * RBAC early gate 回归测试 — 使用真实 Fastify 实例 + 真实 rbac plugin。
 *
 * 覆盖：
 *   - 普通 JWT：角色有 shop 权限、shop 不活动 → 403
 *   - JWT 超级管理员：角色含 `__super_admin__`、shop 不活动 → 403
 *   - `*` PAT：角色有 shop 权限与 bypass、shop 不活动 → 403
 *   - shop 重新活动后：相同角色/PAT 在前提满足时 → 200
 *   - Core 权限在插件禁用时仍 → 200
 *
 * 关键约束：
 *   - 不允许在测试中复制 `if (!activeCodes.has(permCode))`，
 *     任何断言必须经由 `app.requirePermission(permCode)` 走到的真实 preHandler。
 *   - 不允许 stub `requirePermission`；测试调用真实装饰器 + 真实 RBAC plugin。
 */

import Fastify from 'fastify'
import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import rbacPlugin from '../src/core/plugins/external/rbac'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler'
import {
  initGlobalCatalog,
  invalidateGlobalCatalog,
} from '../src/core/services/permission-catalog.service'
import { PermissionService } from '../src/core/services/permission.service'
import { BusinessError } from '../src/exceptions/business-error.js'
import { AuthErrorCode } from '../src/constants/business-codes/auth.js'
import { PAT_WILDCARD } from '../src/constants/permission-codes.js'
import type { PluginManifest } from '../src/core/plugin-platform/types'

// --------------------------------------------------------------------------
// 最小 jwt-auth 占位插件：rbac 声明了 dependencies: ['jwt-auth']，因此必须先
// 注册一个同名插件让其通过依赖校验。stub 不做任何认证，仅作为命名占位。
// --------------------------------------------------------------------------
const jwtAuthStub = fp(async () => undefined, { name: 'jwt-auth' })

// --------------------------------------------------------------------------
// helper
// --------------------------------------------------------------------------

const SHOP_MANIFEST: PluginManifest = {
  pluginId: 'yishan/shop',
  name: 'shop',
  version: '1.0.0',
  scope: 'shop',
  permissions: [
    { code: 'shop:product:list', label: '商品列表', group: 'shop' },
    { code: 'shop:product:create', label: '商品创建', group: 'shop' },
  ],
  menus: [],
} as PluginManifest

const CORE_MANIFEST: PluginManifest = {
  pluginId: 'yishan/core',
  name: 'core',
  version: '1.0.0',
  scope: 'core',
  permissions: [
    { code: 'system:user:list', label: '用户列表', group: 'system' },
  ],
  menus: [],
} as PluginManifest

const manifestReader = {
  listManifests: () => [SHOP_MANIFEST, CORE_MANIFEST],
}

interface BuildAppOptions {
  shopEnabled: boolean
}

interface BuiltApp {
  fastify: FastifyInstance
  close: () => Promise<void>
}

/**
 * 创建带真实 RBAC plugin 的 Fastify 实例，并基于数据库快照构建一次全局 Catalog。
 * 测试路由 `/shop-product-list` 与 `/user-list` 都挂真实 `requirePermission` preHandler。
 */
async function buildApp({ shopEnabled }: BuildAppOptions): Promise<BuiltApp> {
  // 重新初始化 Catalog，让禁用状态重新生效
  await initGlobalCatalog(
    async () => {
      const snapshots: { pluginId: string; enabled: boolean; updatedAt: string | null }[] = []
      if (shopEnabled) {
        snapshots.push({ pluginId: 'yishan/shop', enabled: true, updatedAt: '2024-01-02T00:00:00Z' })
      }
      return snapshots
    },
    manifestReader,
  )

  const fastify = Fastify({ logger: false })
  // 真实 error-handler：保证 BusinessError → HTTP 403 的链路被覆盖
  await fastify.register(errorHandlerPlugin)
  // 真实 RBAC plugin 必须由 jwt-auth 先行注册（生产 app.ts 通过自动加载完成）
  await fastify.register(jwtAuthStub)
  await fastify.register(rbacPlugin)
  // 注册被真实 requirePermission 保护的路由
  fastify.get('/shop-product-list', {
    preHandler: fastify.requirePermission('shop:product:list'),
  }, async () => ({ ok: true, scope: 'shop' }))
  fastify.get('/user-list', {
    preHandler: fastify.requirePermission('system:user:list'),
  }, async () => ({ ok: true, scope: 'core' }))
  await fastify.ready()
  return {
    fastify,
    close: async () => {
      await fastify.close()
      await invalidateGlobalCatalog()
    },
  }
}

/**
 * 工具方法：直接调用 `app.requirePermission(perm)` 返回的真实 preHandler。
 * 用于在不依赖 `preHandler` 钩子顺序的情况下验证拒绝路径。
 */
async function callPreHandler(
  fastify: FastifyInstance,
  perm: string,
  request: { currentUser?: unknown; tokenScope?: string[] | undefined },
): Promise<{ status: number; body?: { code?: number } }> {
  try {
    await fastify.requirePermission(perm)(
      request as unknown as FastifyRequest,
      {} as FastifyReply,
    )
    return { status: 200 }
  } catch (err) {
    if (err instanceof BusinessError) {
      return { status: err.code === AuthErrorCode.UNAUTHORIZED ? 401 : 403, body: { code: err.code } }
    }
    throw err
  }
}

// --------------------------------------------------------------------------
// tests
// --------------------------------------------------------------------------

describe('requirePermission early gate — 通过真实 RBAC plugin', () => {
  let loadForRoleIdsSpy: ReturnType<typeof vi.spyOn>
  let isPatEnabledSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    PermissionService['cache' as never] = new Map()
    loadForRoleIdsSpy = vi.spyOn(PermissionService, 'loadForRoleIds')
  })

  afterEach(async () => {
    loadForRoleIdsSpy?.mockRestore()
    isPatEnabledSpy = undefined
  })

  // ------------------------------------------------------------
  // Case 1: 普通 JWT，shop 不活动 → 403
  // ------------------------------------------------------------
  it('D. JWT 普通角色：shop 不活动时访问受限接口 → 403', async () => {
    loadForRoleIdsSpy.mockResolvedValue({
      perms: new Set(['shop:product:list', 'system:user:list']),
      roleCodes: new Set(['user']),
    })
    const { fastify, close } = await buildApp({ shopEnabled: false })

    const result = await callPreHandler(fastify, 'shop:product:list', {
      currentUser: { id: 1, roleIds: [10] },
    })

    expect(result.status).toBe(403)
    expect(result.body?.code).toBe(AuthErrorCode.FORBIDDEN)

    await close()
  })

  // ------------------------------------------------------------
  // Case 2: JWT 超级管理员，shop 不活动 → 403
  // ------------------------------------------------------------
  it('E. JWT 超级管理员：rolePerms 含 __super_admin__，shop 不活动 → 403', async () => {
    loadForRoleIdsSpy.mockResolvedValue({
      perms: new Set(['system:user:list', '__super_admin__']),
      roleCodes: new Set(['super_admin']),
    })

    const { fastify, close } = await buildApp({ shopEnabled: false })

    const result = await callPreHandler(fastify, 'shop:product:list', {
      currentUser: { id: 1, roleIds: [1] },
    })
    expect(result.status).toBe(403)
    expect(result.body?.code).toBe(AuthErrorCode.FORBIDDEN)

    await close()
  })

  // ------------------------------------------------------------
  // Case 3: PAT 通配符 '*'，shop 不活动 → 403
  // ------------------------------------------------------------
  it('F. PAT wildcard (*)：shop 不活动 → 403', async () => {
    loadForRoleIdsSpy.mockResolvedValue({
      perms: new Set(['shop:product:list', 'shop:product:create', '__super_admin__']),
      roleCodes: new Set(['super_admin']),
    })

    const { fastify, close } = await buildApp({ shopEnabled: false })

    const result = await callPreHandler(fastify, 'shop:product:list', {
      currentUser: { id: 1, roleIds: [1] },
      tokenScope: [PAT_WILDCARD],
    })
    expect(result.status).toBe(403)
    expect(result.body?.code).toBe(AuthErrorCode.FORBIDDEN)

    await close()
  })

  // ------------------------------------------------------------
  // Case 4: shop 重新活动后，role 满足时 preHandler 不抛错
  // ------------------------------------------------------------
  it('G. shop 重新活动后，相同角色满足条件下能放行', async () => {
    loadForRoleIdsSpy.mockResolvedValue({
      perms: new Set(['shop:product:list']),
      roleCodes: new Set(['user']),
    })

    // 重新初始化为 enabled
    const { fastify, close } = await buildApp({ shopEnabled: true })

    const result = await callPreHandler(fastify, 'shop:product:list', {
      currentUser: { id: 1, roleIds: [10] },
    })
    expect(result.status).toBe(200)

    await close()
  })

  // ------------------------------------------------------------
  // Case 5: Core 权限在插件禁用时仍 200
  // ------------------------------------------------------------
  it('Core 权限在所有插件禁用时仍允许访问', async () => {
    loadForRoleIdsSpy.mockResolvedValue({
      perms: new Set(['system:user:list']),
      roleCodes: new Set(['user']),
    })

    const { fastify, close } = await buildApp({ shopEnabled: false })

    const result = await callPreHandler(fastify, 'system:user:list', {
      currentUser: { id: 1, roleIds: [10] },
    })
    expect(result.status).toBe(200)

    await close()
  })

  // ------------------------------------------------------------
  // Case 6: 完整 HTTP 链路 — 通过 fastify.inject 验证 403
  // ------------------------------------------------------------
  it('完整 HTTP 链路：禁用插件的受限路径必须返回 403', async () => {
    loadForRoleIdsSpy.mockResolvedValue({
      perms: new Set(['shop:product:list', 'system:user:list']),
      roleCodes: new Set(['user']),
    })

    // 重新初始化 Catalog（禁用 shop）后构建带 RBAC plugin 的 Fastify 实例
    await initGlobalCatalog(
      async () => [],
      manifestReader,
    )
    const fastify = Fastify({ logger: false })
    await fastify.register(errorHandlerPlugin)
    await fastify.register(jwtAuthStub)
    await fastify.register(rbacPlugin)
    // 在 ready() 之前挂全局钩子，让所有受限路由走真实 preHandler
    fastify.addHook('preValidation', async (request) => {
      ;(request as any).currentUser = { id: 1, roleIds: [10] }
    })
    fastify.get('/shop-product-list', {
      preHandler: fastify.requirePermission('shop:product:list'),
    }, async () => ({ ok: true, scope: 'shop' }))
    fastify.get('/user-list', {
      preHandler: fastify.requirePermission('system:user:list'),
    }, async () => ({ ok: true, scope: 'core' }))
    await fastify.ready()

    const shopRes = await fastify.inject({ method: 'GET', url: '/shop-product-list' })
    expect(shopRes.statusCode).toBe(403)

    const userRes = await fastify.inject({ method: 'GET', url: '/user-list' })
    expect(userRes.statusCode).toBe(200)

    await fastify.close()
    await invalidateGlobalCatalog()
  })

  // ------------------------------------------------------------
  // Case 7: 拒绝原因必须来自真实 early gate（消息文本）
  // ------------------------------------------------------------
  it('拒绝文案包含 "不在活动权限目录中"，证明来自真实 early gate', async () => {
    loadForRoleIdsSpy.mockResolvedValue({
      perms: new Set(['shop:product:list']),
      roleCodes: new Set(['user']),
    })
    const { fastify, close } = await buildApp({ shopEnabled: false })

    try {
      await fastify.requirePermission('shop:product:list')(
        { currentUser: { id: 1, roleIds: [10] } } as unknown as FastifyRequest,
        {} as FastifyReply,
      )
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BusinessError)
      const be = err as BusinessError
      expect(be.code).toBe(AuthErrorCode.FORBIDDEN)
      expect(be.message).toContain('不在活动权限目录中')
    }

    await close()
  })
})
