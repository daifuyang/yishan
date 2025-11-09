import Fastify from 'fastify'
import adminDeptsPlugin from '../src/routes/api/v1/admin/departments/index.ts'
import registerDeptSchemas from '../src/schemas/department.ts'
import registerCommonSchemas from '../src/schemas/common.ts'
import errorHandlerPlugin from '../src/plugins/external/error-handler.ts'
import { DeptService } from '../src/services/dept.service.ts'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.ts'
import { DeptErrorCode } from '../src/constants/business-codes/dept.ts'
import { BusinessError } from '../src/exceptions/business-error.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  // 先注册通用Schema（包含paginationResponse），否则响应schema校验会失败
  registerCommonSchemas(app)
  registerDeptSchemas(app)
  await app.register(adminDeptsPlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Admin Departments routes', () => {
  it('GET / 应返回分页的部门列表', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const list = [
      {
        id: 1,
        name: '技术部',
        parentId: null,
        parentName: undefined,
        status: 1,
        sort_order: 1,
        description: '技术研发部门',
        leaderId: 2,
        leaderName: 'zhangsan',
        creatorId: 1,
        creatorName: 'system',
        createdAt: now,
        updaterId: 1,
        updaterName: 'system',
        updatedAt: now,
      }
    ] as any

    vi.spyOn(DeptService, 'getDeptList').mockResolvedValue({ list, total: 1, page: 1, pageSize: 10 })

    const res = await app.inject({ method: 'GET', url: '/?page=1&pageSize=10&keyword=tech&status=1&sortBy=sort_order&sortOrder=asc' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(1)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.pageSize).toBe(10)
    expect(body.pagination.total).toBe(1)

    await app.close()
  })

  it('POST / 成功创建部门', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const created = {
      id: 100,
      name: '市场部',
      parentId: null,
      parentName: undefined,
      status: 1,
      sort_order: 0,
      description: '市场推广部门',
      leaderId: 3,
      leaderName: 'lisi',
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
    } as any

    vi.spyOn(DeptService, 'createDept').mockResolvedValue(created)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: '市场部', status: 1 }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 100, name: '市场部' })

    await app.close()
  })

  it('POST / 当部门已存在返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(DeptService, 'createDept').mockRejectedValue(
      new BusinessError(DeptErrorCode.DEPT_ALREADY_EXISTS, '部门已存在')
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: '技术部' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(DeptErrorCode.DEPT_ALREADY_EXISTS)

    await app.close()
  })

  it('PUT /:id 成功更新部门返回 200', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const updated = {
      id: 5,
      name: '技术支持部',
      parentId: 1,
      parentName: '技术部',
      status: 1,
      sort_order: 2,
      description: '技术支持',
      leaderId: 4,
      leaderName: 'wangwu',
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
    } as any

    vi.spyOn(DeptService, 'updateDept').mockResolvedValue(updated)

    const res = await app.inject({ method: 'PUT', url: '/5', payload: { name: '技术支持部' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 5, name: '技术支持部' })

    await app.close()
  })

  it('PUT /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'PUT', url: '/abc', payload: { name: 'any' } })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 部门不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(DeptService, 'updateDept').mockRejectedValue(
      new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, '部门不存在')
    )

    const res = await app.inject({ method: 'PUT', url: '/99', payload: { name: 'x' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(DeptErrorCode.DEPT_NOT_FOUND)

    await app.close()
  })

  it('DELETE /:id 删除部门返回成功', async () => {
    const app = await buildApp()

    vi.spyOn(DeptService, 'deleteDept').mockResolvedValue({ id: 7 })

    const res = await app.inject({ method: 'DELETE', url: '/7' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 7 })

    await app.close()
  })

  it('GET /:id 成功获取部门详情', async () => {
    const app = await buildApp()

    const deptDetail = {
      id: 5,
      name: '研发部',
      parentId: 0,
      parentName: '总部',
      status: 1,
      sort_order: 10,
      description: '技术研发部门',
      leaderId: 3,
      leaderName: '李四',
      creatorId: 1,
      creatorName: 'admin',
      createdAt: new Date().toISOString(),
      updaterId: 2,
      updaterName: 'ops',
      updatedAt: new Date().toISOString()
    }

    vi.spyOn(DeptService, 'getDeptById').mockResolvedValue(deptDetail as any)

    const res = await app.inject({ method: 'GET', url: '/5' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 5, name: '研发部' })

    await app.close()
  })

  it('GET /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'GET', url: '/abc' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('GET /:id 部门不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(DeptService, 'getDeptById').mockResolvedValue(null as any)

    const res = await app.inject({ method: 'GET', url: '/99' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(DeptErrorCode.DEPT_NOT_FOUND)

    await app.close()
  })

  it('DELETE /:id 存在子部门禁止删除（业务错误码）', async () => {
    const app = await buildApp()

    vi.spyOn(DeptService, 'deleteDept').mockRejectedValue(
      new BusinessError(DeptErrorCode.DEPT_DELETE_FORBIDDEN, '存在子部门，禁止删除')
    )

    const res = await app.inject({ method: 'DELETE', url: '/10' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(DeptErrorCode.DEPT_DELETE_FORBIDDEN)

    await app.close()
  })

  it('POST / 参数不合法应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'POST', url: '/', payload: {} })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })
})