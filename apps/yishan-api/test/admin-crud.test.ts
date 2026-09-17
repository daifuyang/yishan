import { describe, expect, it, vi } from 'vitest'
import { createCrudHandlers } from '../src/core/routes/admin-crud.ts'

describe('createCrudHandlers', () => {
  it('自动注册 CRUD 权限并将列表结果包装成分页响应', async () => {
    const routes: Record<string, any> = {}
    const route = {
      get: vi.fn((path, options, handler) => { routes[`GET ${path}`] = { options, handler } }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as any
    const registerPermissions = vi.fn()

    const crud = createCrudHandlers(route, {
      resource: 'position',
      group: 'system',
      perms: {
        list: '岗位列表',
        create: '岗位创建',
        update: '岗位编辑',
        delete: '岗位删除',
      },
      registerPermissions,
      messages: { listSuccess: () => '列表成功' },
    })

    crud.list({
      schema: { operationId: 'getPositionList' },
      service: vi.fn().mockResolvedValue({ list: [{ id: 1 }], total: 1 }),
    })

    expect(registerPermissions).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'system:position:list', label: '岗位列表' }),
      expect.objectContaining({ code: 'system:position:create', label: '岗位创建' }),
      expect.objectContaining({ code: 'system:position:update', label: '岗位编辑' }),
      expect.objectContaining({ code: 'system:position:delete', label: '岗位删除' }),
    )

    const reply = { send: vi.fn() }
    await routes['GET /'].handler({ query: { page: 2, pageSize: 5 }, headers: {} }, reply)
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      data: [{ id: 1 }],
      message: '列表成功',
      pagination: { page: 2, pageSize: 5, total: 1, totalPages: 1 },
    }))
  })
})
