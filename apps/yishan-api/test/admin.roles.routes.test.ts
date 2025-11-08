import Fastify from 'fastify'
import adminRolesPlugin from '../src/routes/api/v1/admin/roles/index.ts'
import registerRoleSchemas from '../src/schemas/role.ts'
import registerCommonSchemas from '../src/schemas/common.ts'
import errorHandlerPlugin from '../src/plugins/external/error-handler.ts'
import { RoleService } from '../src/services/role.service.ts'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.ts'
import { RoleErrorCode } from '../src/constants/business-codes/role.ts'
import { BusinessError } from '../src/exceptions/business-error.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  // 先注册通用Schema（包含paginationResponse），否则响应schema校验会失败
  registerCommonSchemas(app)
  registerRoleSchemas(app)
  await app.register(adminRolesPlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Admin Roles routes', () => {
  it('GET / 应返回分页的角色列表', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const list = [
      {
        id: 1,
        name: 'admin',
        description: '系统管理员',
        status: 1,
        creatorId: 1,
        creatorName: 'system',
        createdAt: now,
        updaterId: 1,
        updaterName: 'system',
        updatedAt: now,
      }
    ] as any

    vi.spyOn(RoleService, 'getRoleList').mockResolvedValue({ list, total: 1, page: 2, pageSize: 5 })

    const res = await app.inject({ method: 'GET', url: '/?page=2&pageSize=5&keyword=a&status=1&sortBy=createdAt&sortOrder=desc' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(1)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.pageSize).toBe(5)
    expect(body.pagination.total).toBe(1)

    await app.close()
  })

  it('POST / 成功创建角色', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const created = {
      id: 100,
      name: 'manager',
      description: '业务经理',
      status: 1,
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
    } as any

    vi.spyOn(RoleService, 'createRole').mockResolvedValue(created)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        name: 'manager',
        description: '业务经理',
        status: 1,
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 100, name: 'manager' })

    await app.close()
  })

  it('POST / 当角色已存在返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(RoleService, 'createRole').mockRejectedValue(
      new BusinessError(RoleErrorCode.ROLE_ALREADY_EXISTS, '角色已存在')
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        name: 'dup',
        description: '重复角色',
        status: 1,
      }
    })

    // 角色业务错误默认映射到HTTP 200（业务错误）
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(RoleErrorCode.ROLE_ALREADY_EXISTS)

    await app.close()
  })

  it('PUT /:id 成功更新角色返回 200', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const updated = {
      id: 5,
      name: 'auditor',
      description: '审计角色',
      status: 1,
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
    } as any

    vi.spyOn(RoleService, 'updateRole').mockResolvedValue(updated)

    const res = await app.inject({
      method: 'PUT',
      url: '/5',
      payload: {
        name: 'auditor',
        description: '审计角色'
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 5, name: 'auditor' })

    await app.close()
  })

  it('PUT /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'PUT',
      url: '/abc',
      payload: { name: 'any' }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 角色不存在返回角色业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(RoleService, 'updateRole').mockRejectedValue(
      new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, '角色不存在')
    )

    const res = await app.inject({
      method: 'PUT',
      url: '/99',
      payload: { name: 'x' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(RoleErrorCode.ROLE_NOT_FOUND)

    await app.close()
  })

  it('DELETE /:id 删除角色返回成功', async () => {
    const app = await buildApp()

    vi.spyOn(RoleService, 'deleteRole').mockResolvedValue({ id: 7 })

    const res = await app.inject({ method: 'DELETE', url: '/7' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 7 })

    await app.close()
  })
})