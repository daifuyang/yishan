import Fastify from 'fastify'
import adminUsersPlugin from '../src/routes/api/v1/admin/users/index.ts'
import registerUserSchemas from '../src/schemas/user.ts'
import registerCommonSchemas from '../src/schemas/common.ts'
import errorHandlerPlugin from '../src/plugins/external/error-handler.ts'
import { UserService } from '../src/services/user.service.ts'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.ts'
import { UserErrorCode } from '../src/constants/business-codes/user.ts'
import { BusinessError } from '../src/exceptions/business-error.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  // 先注册通用Schema（包含paginationResponse），否则响应schema校验会失败
  registerCommonSchemas(app)
  registerUserSchemas(app)
  await app.register(adminUsersPlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Admin Users routes', () => {
  it('GET / 应返回分页的用户列表', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const list = [
      {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        realName: 'Admin',
        gender: 1,
        genderName: '男',
        status: 1,
        statusName: '启用',
        loginCount: 10,
        creatorId: 1,
        creatorName: 'system',
        createdAt: now,
        updaterId: 1,
        updaterName: 'system',
        updatedAt: now,
        lastLoginTime: now
      }
    ] as any

    vi.spyOn(UserService, 'getUserList').mockResolvedValue({ list, total: 1, page: 2, pageSize: 5 })

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

  it('POST / 成功创建用户', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const created = {
      id: 100,
      username: 'newuser',
      email: 'new@example.com',
      realName: 'New User',
      gender: 1,
      genderName: '男',
      status: 1,
      statusName: '启用',
      loginCount: 0,
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now
    } as any

    vi.spyOn(UserService, 'createUser').mockResolvedValue(created)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'newuser',
        email: 'new@example.com',
        password: 'Abcd1234',
        realName: 'New User',
        status: 1
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 100, username: 'newuser' })

    await app.close()
  })

  it('POST / 当用户已存在返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'createUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, '用户名已存在')
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'dup',
        email: 'dup@example.com',
        password: 'Abcd1234',
        realName: 'Dup User',
        status: 1
      }
    })

    // 用户模块错误默认映射到HTTP 200（业务错误）
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_ALREADY_EXISTS)

    await app.close()
  })

  it('PUT /:id 成功更新用户返回 200', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const updated = {
      id: 5,
      username: 'updated',
      email: 'updated@example.com',
      realName: 'Updated User',
      gender: 1,
      genderName: '男',
      status: 1,
      statusName: '启用',
      loginCount: 11,
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now
    } as any

    vi.spyOn(UserService, 'updateUser').mockResolvedValue(updated)

    const res = await app.inject({
      method: 'PUT',
      url: '/5',
      payload: {
        username: 'updated',
        email: 'updated@example.com',
        password: 'Abcd1234',
        realName: 'Updated User',
        status: 1
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 5, username: 'updated' })

    await app.close()
  })

  it('PUT /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'PUT',
      url: '/abc',
      payload: {
        username: 'any',
        email: 'any@example.com',
        password: 'Abcd1234',
        realName: 'Any User',
        status: 1
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 用户不存在返回用户业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'updateUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_NOT_FOUND, '用户不存在')
    )

    const res = await app.inject({
      method: 'PUT',
      url: '/99',
      payload: {
        username: 'x',
        email: 'x@example.com',
        password: 'Abcd1234',
        realName: 'X User',
        status: 1
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_NOT_FOUND)

    await app.close()
  })

  it('PUT /:id 若服务抛出非 BusinessError 应返回 500 系统错误', async () => {
    const app = await buildApp()

    // 服务层可能抛出普通 Error，错误处理器将按系统错误处理
    vi.spyOn(UserService, 'updateUser').mockRejectedValue(new Error(`${UserErrorCode.USER_ALREADY_EXISTS}`))

    const res = await app.inject({
      method: 'PUT',
      url: '/5',
      payload: {
        username: 'dup',
        email: 'dup@example.com',
        password: 'Abcd1234',
        realName: 'Dup User',
        status: 1
      }
    })

    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.success).toBe(false)
    // 默认系统错误码
    expect(body.code).toBe(20001)

    await app.close()
  })

  it('DELETE /:id 成功删除用户', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'deleteUser').mockResolvedValue({ id: 7, deleted: true })

    const res = await app.inject({ method: 'DELETE', url: '/7' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 7, deleted: true })

    await app.close()
  })

  it('DELETE /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'DELETE', url: '/abc' })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('DELETE /:id 用户不存在返回用户业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'deleteUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_NOT_FOUND, '用户不存在')
    )

    const res = await app.inject({ method: 'DELETE', url: '/101' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_NOT_FOUND)

    await app.close()
  })
})