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

// 测试数据工厂函数
const createMockUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  phone: '13800138001',
  realName: '测试用户',
  status: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

const createMockUserList = (count = 2) => {
  const users = []
  for (let i = 1; i <= count; i++) {
    users.push({
      id: i,
      username: `testuser${i}`,
      email: `test${i}@example.com`,
      phone: `1380013800${i}`,
      realName: `测试用户${i}`,
      status: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }
  return users
}

const createValidUserPayload = (overrides = {}) => ({
  username: 'newuser',
  email: 'new@example.com',
  password: 'Password123',
  phone: '13800138004',
  realName: '新用户',
  status: 1,
  ...overrides
})

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
        phone: '13800138000',
        realName: '管理员',
        nickname: '系统管理员',
        avatar: 'https://example.com/avatar.jpg',
        gender: 1,
        genderName: '男',
        birthDate: '1990-01-01',
        status: 1,
        statusName: '启用',
        lastLoginTime: now,
        lastLoginIp: '127.0.0.1',
        loginCount: 10,
        creatorId: 1,
        creatorName: 'system',
        createdAt: now,
        updaterId: 1,
        updaterName: 'system',
        updatedAt: now,
        deptIds: [1, 2],
        roleIds: [1]
      }
    ] as any

    vi.spyOn(UserService, 'getUserList').mockResolvedValue({ list, total: 1, page: 1, pageSize: 10 })

    const res = await app.inject({ method: 'GET', url: '/?page=1&pageSize=10&keyword=admin&status=1&sortBy=createdAt&sortOrder=desc' })

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

  it('GET /:id 成功获取用户详情', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const userDetail = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      phone: '13800138000',
      realName: '管理员',
      nickname: '系统管理员',
      avatar: 'https://example.com/avatar.jpg',
      gender: 1,
      genderName: '男',
      birthDate: '1990-01-01',
      status: 1,
      statusName: '启用',
      lastLoginTime: now,
      lastLoginIp: '127.0.0.1',
      loginCount: 10,
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
      deptIds: [1, 2],
      roleIds: [1]
    } as any

    vi.spyOn(UserService, 'getUserById').mockResolvedValue(userDetail)

    const res = await app.inject({ method: 'GET', url: '/1' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 1, username: 'admin' })

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

  it('GET /:id 用户不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'getUserById').mockResolvedValue(null as any)

    const res = await app.inject({ method: 'GET', url: '/999' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_NOT_FOUND)

    await app.close()
  })

  it('POST / 成功创建用户返回 200', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'createUser').mockResolvedValue(
      createMockUser({
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        phone: '13800138004',
        realName: '新用户'
      })
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: createValidUserPayload()
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.username).toBe('newuser')

    await app.close()
  })

  it('POST / 当用户名已存在返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'createUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, '用户名已存在')
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'existing_user_test',
        email: 'new_test@example.com',
        password: 'Password123',
        phone: '13800138200',
        realName: '新用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_ALREADY_EXISTS)

    await app.close()
  })

  it('POST / 当邮箱已存在返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'createUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, '邮箱已存在')
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'newuser_test',
        email: 'existing_test@example.com',
        password: 'Password123',
        phone: '13800138300',
        realName: '新用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_ALREADY_EXISTS)

    await app.close()
  })

  it('POST / 当手机号已存在返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'createUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, '手机号已存在')
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'newuser_phone_test',
        email: 'new_phone_test@example.com',
        password: 'Password123',
        phone: '13800138400',
        realName: '新用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_ALREADY_EXISTS)

    await app.close()
  })

  it('POST / 密码强度不够返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'createUser').mockRejectedValue(
      new BusinessError(UserErrorCode.PASSWORD_WEAK, '密码强度不足')
    )

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'newuser',
        email: 'new@example.com',
        password: '123',
        phone: '13800138004',
        realName: '新用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.PASSWORD_WEAK)

    await app.close()
  })

  it('POST / 缺少必填字段应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        // 缺少 username
        email: 'test@example.com',
        password: 'Password123',
        phone: '13800138005',
        realName: '测试用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('POST / 无效邮箱格式应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'testuser',
        email: 'invalid-email-format',
        password: 'Password123',
        phone: '13800138006',
        realName: '测试用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('POST / 无效手机号格式应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        phone: '12345',
        realName: '测试用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('POST / 超长用户名应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'a'.repeat(51), // 超过50字符限制
        email: 'test@example.com',
        password: 'Password123',
        phone: '13800138007',
        realName: '测试用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('POST / 无效状态值应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        phone: '13800138008',
        realName: '测试用户',
        status: 999 // 无效状态值
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('POST / 无效性别值应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        phone: '13800138009',
        realName: '测试用户',
        status: 1,
        gender: 999 // 无效性别值
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 成功更新用户返回 200', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'updateUser').mockResolvedValue(
      createMockUser({
        id: 5,
        username: 'updateduser',
        email: 'updated@example.com',
        phone: '13800138005',
        realName: '更新用户'
      })
    )

    const res = await app.inject({
      method: 'PUT',
      url: '/5',
      payload: {
        username: 'updateduser',
        email: 'updated@example.com',
        phone: '13800138005',
        realName: '更新用户'
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 5, username: 'updateduser' })

    await app.close()
  })

  it('PUT /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'PUT',
      url: '/abc',
      payload: { username: 'any' }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 用户不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'updateUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_NOT_FOUND, '用户不存在')
    )

    const res = await app.inject({
      method: 'PUT',
      url: '/999',
      payload: { username: 'updated' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_NOT_FOUND)

    await app.close()
  })

  it('PUT /:id 边界条件 - 空数组参数', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'updateUser').mockResolvedValue({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      phone: '13800138001',
      realName: '测试用户',
      status: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)

    const res = await app.inject({
      method: 'PUT',
      url: '/1',
      payload: {
        username: 'testuser',
        email: 'test@example.com',
        phone: '13800138001',
        realName: '测试用户',
        status: 1,
        deptIds: [], // 空数组
        roleIds: []  // 空数组
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)

    await app.close()
  })

  it('PUT /:id 边界条件 - 超长字符串', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'PUT',
      url: '/1',
      payload: {
        username: 'a'.repeat(51), // 超过50字符限制
        email: 'test@example.com',
        phone: '13800138001',
        realName: '测试用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 边界条件 - 最小长度用户名', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'updateUser').mockResolvedValue({
      id: 1,
      username: 'a',
      email: 'test@example.com',
      phone: '13800138001',
      realName: '测试用户',
      status: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)

    const res = await app.inject({
      method: 'PUT',
      url: '/1',
      payload: {
        username: 'a', // 最小长度1字符
        email: 'test@example.com',
        phone: '13800138001',
        realName: '测试用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)

    await app.close()
  })

  it('PUT /:id 边界条件 - 特殊字符用户名', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'PUT',
      url: '/1',
      payload: {
        username: 'user@#$%', // 特殊字符
        email: 'test@example.com',
        phone: '13800138001',
        realName: '测试用户',
        status: 1
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 尝试禁用超级管理员返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'updateUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_STATUS_ERROR, '系统管理员不可禁用')
    )

    const res = await app.inject({
      method: 'PUT',
      url: '/1',
      payload: { status: 0 }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_STATUS_ERROR)

    await app.close()
  })

  it('DELETE /:id 删除用户返回成功', async () => {
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

  it('DELETE /:id 用户不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'deleteUser').mockRejectedValue(
      new BusinessError(UserErrorCode.USER_NOT_FOUND, '用户不存在或已删除')
    )

    const res = await app.inject({ method: 'DELETE', url: '/999' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.USER_NOT_FOUND)

    await app.close()
  })

  it('DELETE /:id 尝试删除超级管理员返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'deleteUser').mockRejectedValue(
      new BusinessError(UserErrorCode.DELETE_SUPER_ADMIN_NOT_ALLOWED, '不能删除超级管理员')
    )

    const res = await app.inject({
      method: 'DELETE',
      url: '/1'
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(UserErrorCode.DELETE_SUPER_ADMIN_NOT_ALLOWED)

    await app.close()
  })

  it('POST / 并发创建相同用户名应处理冲突', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'createUser')
      .mockResolvedValueOnce({
        id: 1,
        username: 'duplicateuser',
        email: 'user1@example.com',
        phone: '13800138010',
        realName: '用户1',
        status: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .mockRejectedValueOnce(
        new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, '用户名已存在')
      )

    // 第一个请求成功
    const res1 = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'duplicateuser',
        email: 'user1@example.com',
        password: 'Password123',
        phone: '13800138010',
        realName: '用户1',
        status: 1
      }
    })

    expect(res1.statusCode).toBe(200)
    expect(res1.json().success).toBe(true)

    // 第二个请求应该失败
    const res2 = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        username: 'duplicateuser',
        email: 'user2@example.com',
        password: 'Password123',
        phone: '13800138011',
        realName: '用户2',
        status: 1
      }
    })

    expect(res2.statusCode).toBe(200)
    const body2 = res2.json()
    expect(body2.success).toBe(false)
    expect(body2.code).toBe(UserErrorCode.USER_ALREADY_EXISTS)

    await app.close()
  })

  it('PUT /:id 并发更新应处理冲突', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'updateUser')
      .mockResolvedValueOnce({
        id: 1,
        username: 'updateduser',
        email: 'updated@example.com',
        phone: '13800138012',
        realName: '更新用户1',
        status: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .mockRejectedValueOnce(
        new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, '用户名已存在')
      )

    // 第一个更新成功
    const res1 = await app.inject({
      method: 'PUT',
      url: '/1',
      payload: {
        username: 'updateduser',
        email: 'updated@example.com',
        phone: '13800138012',
        realName: '更新用户1',
        status: 1
      }
    })

    expect(res1.statusCode).toBe(200)
    expect(res1.json().success).toBe(true)

    // 第二个更新应该失败（假设另一个用户尝试使用相同的用户名）
    const res2 = await app.inject({
      method: 'PUT',
      url: '/2',
      payload: {
        username: 'updateduser',
        email: 'another@example.com',
        phone: '13800138013',
        realName: '更新用户2',
        status: 1
      }
    })

    expect(res2.statusCode).toBe(200)
    const body2 = res2.json()
    expect(body2.success).toBe(false)
    expect(body2.code).toBe(UserErrorCode.USER_ALREADY_EXISTS)

    await app.close()
  })

  it('POST / 快速重复提交应处理幂等性', async () => {
    const app = await buildApp()

    let callCount = 0
    vi.spyOn(UserService, 'createUser').mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          id: 1,
          username: 'rapiduser',
          email: 'rapid@example.com',
          phone: '13800138014',
          realName: '快速用户',
          status: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      } else {
        return Promise.reject(
          new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, '用户名已存在')
        )
      }
    })

    const payload = {
      username: 'rapiduser',
      email: 'rapid@example.com',
      password: 'Password123',
      phone: '13800138014',
      realName: '快速用户',
      status: 1
    }

    // 模拟快速重复提交
    const [res1, res2] = await Promise.all([
      app.inject({ method: 'POST', url: '/', payload }),
      app.inject({ method: 'POST', url: '/', payload })
    ])

    // 至少有一个请求应该成功
    const successCount = [res1, res2].filter(res => res.json().success).length
    expect(successCount).toBeGreaterThanOrEqual(1)

    // 总调用次数应该为2
    expect(callCount).toBe(2)

    await app.close()
  })

  it('GET / 分页参数错误返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: '/',
      query: {
        page: '0', // 无效页码
        pageSize: '10'
      }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('GET / 组合查询参数测试', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'getUserList').mockResolvedValue({
      list: createMockUserList(1),
      total: 1
    })

    const res = await app.inject({
      method: 'GET',
      url: '/',
      query: {
        keyword: 'test',
        status: '1',
        deptId: '1',
        roleId: '1',
        page: '1',
        pageSize: '10',
        startTime: '2024-01-01',
        endTime: '2024-12-31'
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.total).toBe(1)

    await app.close()
  })

  it('GET / 模糊搜索测试', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'getUserList').mockResolvedValue({
      list: [
        createMockUser({ id: 1, username: 'testuser' }),
        createMockUser({ id: 2, username: 'testinguser' })
      ],
      total: 2
    })

    const res = await app.inject({
      method: 'GET',
      url: '/',
      query: {
        keyword: 'test',
        page: '1',
        pageSize: '10'
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(2)

    await app.close()
  })

  it('GET / 状态过滤测试', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'getUserList').mockResolvedValue({
      list: [createMockUser({ username: 'activeuser', email: 'active@example.com', status: 0 })],
      total: 1
    })

    const res = await app.inject({
      method: 'GET',
      url: '/',
      query: {
        status: '0',
        page: '1',
        pageSize: '10'
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].status).toBe(0)

    await app.close()
  })

  it('GET / 时间范围查询测试', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'getUserList').mockResolvedValue({
      list: [
        createMockUser({ id: 1, username: 'testuser', createdAt: new Date('2024-01-15T00:00:00Z') })
      ],
      total: 1
    })

    const res = await app.inject({
      method: 'GET',
      url: '/',
      query: {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-31T23:59:59Z',
        page: '1',
        pageSize: '10'
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.list).toHaveLength(1)

    await app.close()
  })

  it('GET / 大页码测试', async () => {
    const app = await buildApp()

    vi.spyOn(UserService, 'getUserList').mockResolvedValue({
      list: [],
      total: 5
    })

    const res = await app.inject({
      method: 'GET',
      url: '/',
      query: {
        page: '999', // 大页码
        pageSize: '10'
      }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.list).toHaveLength(0) // 空列表
    expect(body.data.total).toBe(5)

    await app.close()
  })
})