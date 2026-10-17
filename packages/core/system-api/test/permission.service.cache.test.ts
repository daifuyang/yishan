/**
 * PermissionService 的进程内 TTL 缓存行为。
 *
 * 这个缓存同时服务「能不能调这个接口」和用户创建授权判定，后者的失败模式是：
 * 刚被回收的角色权限继续授权。因此这里断言的不是性能，而是**缓存不得在
 * `ttlMs: 0` 下命中**，以及注入 db 时缓存完全不被读写。
 *
 * 此前没有同类测试：仓库里所有调用点都把 `loadForRoleIds` 整体 mock 掉了，
 * 缓存分支从未被执行过。
 */
import { afterEach, describe, expect, it, vi } from './runtime-fixture'
import { testRuntime } from './runtime-fixture'
import { PermissionService } from '../src/core/services/permission.service'
import { PermissionRepository } from '../src/core/repositories/permission.repository'

const ROLE_IDS = [3, 4]

function mockRepository(perms: string[], roleCodes: string[] = []): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(PermissionRepository, 'loadPermissionsByRoleIds').mockResolvedValue({
    perms: new Set(perms),
    roleCodes: new Set(roleCodes),
  })
}

function cache() {
  return testRuntime().caches.permissions
}

afterEach(() => {
  vi.restoreAllMocks()
  cache().clear()
})

describe('PermissionService.loadForRoleIds — 缓存开关', () => {
  it('reuses the cached entry within the default ttl', async () => {
    const load = mockRepository(['system:user:list'])
    await PermissionService.loadForRoleIds(ROLE_IDS)
    await PermissionService.loadForRoleIds(ROLE_IDS)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('always reloads with ttlMs: 0 so a revoked permission stops authorizing immediately', async () => {
    const load = mockRepository(['system:user:create'])
    await PermissionService.loadForRoleIds(ROLE_IDS)
    // 权限被回收后，下一次授权判定必须看到空集合，而不是缓存里的旧值。
    mockRepository([])
    await expect(PermissionService.loadForRoleIds(ROLE_IDS, { ttlMs: 0 })).resolves.toMatchObject({
      perms: new Set(),
    })
    // 第二次确实回库了（缓存里那份仍带着已回收的权限）。
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('misses the cache on ttlMs: 0 even when the wall clock has stepped backwards', async () => {
    // 回归：只靠 `now - loadedAt < ttlMs` 时，时钟回拨让差值变负、`< 0` 成立，
    // `ttlMs: 0` 反而命中缓存 —— 刚删除的角色权限会继续授权一整个缓存窗口。
    await PermissionService.loadForRoleIds(ROLE_IDS)
    for (const [key, entry] of cache()) {
      cache().set(key, { ...entry, loadedAt: Date.now() + 60_000 })
    }

    mockRepository(['system:role:list'])
    await expect(PermissionService.loadForRoleIds(ROLE_IDS, { ttlMs: 0 })).resolves.toMatchObject({
      perms: new Set(['system:role:list']),
    })
  })

  it('bypasses the cache entirely when an injected db is supplied', async () => {
    // 注入的通常是事务级句柄：既不该读到共享连接池算出的旧结果，
    // 也不该把事务内未提交的行写进全局缓存。
    const db = { select: () => ({}) } as never
    const load = mockRepository(['system:user:create'])

    await PermissionService.loadForRoleIds(ROLE_IDS, { db });
    expect(load).toHaveBeenCalledWith(ROLE_IDS, db);
    expect(cache().size).toBe(0);

    await PermissionService.loadForRoleIds(ROLE_IDS, { db });
    expect(load).toHaveBeenCalledTimes(2);
  })
})
