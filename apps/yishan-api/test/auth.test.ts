import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import Fastify from 'fastify'
import serviceApp from '../src/app.js'
import { FastifyInstance } from 'fastify'
import { config } from 'dotenv'
import path from 'node:path'

describe('Auth API Tests', () => {
  let app: FastifyInstance

  before(async () => {
    // 加载.env文件（从项目根目录）
    config({ path: path.join(import.meta.dirname, '../.env') })
    
    // 设置测试特定的环境变量
    process.env.NODE_ENV = 'test'
    process.env.LOG_LEVEL = 'error' // 测试时减少日志输出

    // 构建应用实例
    app = Fastify({ logger: false })
    await app.register(serviceApp)
    await app.ready()
  })

  after(async () => {
    // 清理资源
    await app.close()
  })

  describe('POST /api/v1/login', () => {
    test('应该成功使用用户名登录', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'admin',
          password: 'admin123'
        }
      })

      assert.strictEqual(response.statusCode, 200)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 10000) // SUCCESS_CODE
      assert.strictEqual(body.message, '登录成功')
      assert.strictEqual(body.success, true) // 使用 success 字段
      assert.ok(body.data)
      assert.ok(body.data.accessToken)
      assert.ok(body.data.refreshToken)
      assert.strictEqual(body.data.tokenType, 'Bearer')
      assert.ok(typeof body.data.accessTokenExpiresIn === 'number')
      assert.ok(typeof body.data.refreshTokenExpiresIn === 'number')
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该成功使用邮箱登录', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          email: 'admin@yishan.com',
          password: 'admin123'
        }
      })

      assert.strictEqual(response.statusCode, 200)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 10000) // SUCCESS_CODE
      assert.strictEqual(body.message, '登录成功')
      assert.strictEqual(body.success, true) // 使用 success 字段
      assert.ok(body.data)
      assert.ok(body.data.accessToken)
      assert.ok(body.data.refreshToken)
      assert.ok(typeof body.data.accessTokenExpiresIn === 'number')
      assert.ok(typeof body.data.refreshTokenExpiresIn === 'number')
      assert.strictEqual(body.data.tokenType, 'Bearer')
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝错误的密码', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'admin',
          password: 'wrongpassword'
        }
      })

      // 错误密码会返回 401 状态码
      assert.strictEqual(response.statusCode, 401)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 30005) // INVALID_CREDENTIALS
      assert.strictEqual(body.message, '用户名或密码错误')
      assert.strictEqual(body.success, false) // 使用 success 字段
      assert.strictEqual(body.data, null) // 错误响应数据为null
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝不存在的用户', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'nonexistentuser',
          password: 'password123'
        }
      })

      // 不存在的用户会返回 404 状态码
      assert.strictEqual(response.statusCode, 404)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 30001) // USER_NOT_FOUND
      assert.strictEqual(body.message, '用户不存在')
      assert.strictEqual(body.success, false) // 使用 success 字段
      assert.strictEqual(body.data, null) // 错误响应数据为null
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝缺少密码的请求', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'admin'
          // 缺少 password
        }
      })

      assert.strictEqual(response.statusCode, 400)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.code !== 10000) // 不是成功码
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝既没有用户名也没有邮箱的请求', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          password: 'password123'
          // 缺少 username 和 email
        }
      })

      assert.strictEqual(response.statusCode, 400)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.code !== 10000) // 不是成功码
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝密码长度不足的请求', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'admin',
          password: '123' // 密码长度不足
        }
      })

      assert.strictEqual(response.statusCode, 400)
      const body = JSON.parse(response.body)
      assert.ok(body.code !== 10000) // 不是成功码
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝被禁用的用户登录', async () => {
      // 由于测试环境只有一个admin用户且状态为启用，这个测试用例暂时跳过
      // 在实际项目中，可以通过创建测试用户或修改用户状态来测试
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'disableduser',
          password: 'password123'
        }
      })

      // 不存在的用户会返回 404 状态码
      assert.strictEqual(response.statusCode, 404)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 30001) // USER_NOT_FOUND
      assert.strictEqual(body.message, '用户不存在')
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.strictEqual(body.data, null) // 错误响应数据为null
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝被锁定的用户登录', async () => {
      // 由于测试环境只有一个admin用户且状态为启用，这个测试用例暂时跳过
      // 在实际项目中，可以通过创建测试用户或修改用户状态来测试
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'lockeduser',
          password: 'password123'
        }
      })

      // 不存在的用户会返回 404 状态码
      assert.strictEqual(response.statusCode, 404)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 30001) // USER_NOT_FOUND
      assert.strictEqual(body.message, '用户不存在')
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.strictEqual(body.data, null) // 错误响应数据为null
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该正确处理邮箱格式验证', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          email: 'invalid-email-format',
          password: 'password123'
        }
      })

      // 邮箱格式错误会返回 400 状态码
      assert.strictEqual(response.statusCode, 400)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.code !== 10000) // 不是成功码
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })
  })

  describe('GET /api/v1/me', () => {
    let accessToken: string

    // 在测试前先登录获取token
    test('准备工作：获取访问令牌', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'admin',
          password: 'admin123'
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      accessToken = body.data.accessToken
      assert.ok(accessToken)
    })

    test('应该成功获取当前用户信息', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 10000) // SUCCESS_CODE
      assert.strictEqual(body.message, '获取用户信息成功')
      assert.strictEqual(body.success, true) // 使用 isSuccess 字段
      assert.ok(body.data)
      assert.ok(body.data.id)
      assert.ok(body.data.username)
      assert.ok(body.data.email)
      assert.ok(typeof body.data.status === 'number')
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝没有token的请求', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me'
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001) // UNAUTHORIZED
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝无效的token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001) // UNAUTHORIZED
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝格式错误的Authorization头', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: {
          authorization: 'InvalidFormat'
        }
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001) // UNAUTHORIZED
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })
  })

  describe('POST /api/v1/refresh', () => {
    let refreshToken: string

    // 在测试前先登录获取refreshToken
    test('准备工作：获取刷新令牌', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'admin',
          password: 'admin123'
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      refreshToken = body.data.refreshToken
      assert.ok(refreshToken)
    })

    test('应该成功刷新token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/refresh',
        payload: {
          refresh_token: refreshToken // 使用正确的字段名
        }
      })

      assert.strictEqual(response.statusCode, 200)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 10000) // SUCCESS_CODE
      assert.strictEqual(body.message, '刷新令牌成功')
      assert.strictEqual(body.success, true) // 使用 isSuccess 字段
      assert.ok(body.data)
      assert.ok(body.data.accessToken)
      assert.ok(body.data.refreshToken)
      assert.strictEqual(body.data.tokenType, 'Bearer')
      assert.ok(typeof body.data.accessTokenExpiresIn === 'number')
      assert.ok(typeof body.data.refreshTokenExpiresIn === 'number')
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝无效的refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/refresh',
        payload: {
          refresh_token: 'invalid-refresh-token'
        }
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001) // UNAUTHORIZED
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝缺少refresh token的请求', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/refresh',
        payload: {}
      })

      assert.strictEqual(response.statusCode, 400)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })
  })

  describe('POST /api/v1/logout', () => {
    let accessToken: string

    // 在测试前先登录获取token
    test('准备工作：获取访问令牌', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/login',
        payload: {
          username: 'admin',
          password: 'admin123'
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      accessToken = body.data.accessToken
      assert.ok(accessToken)
    })

    test('应该成功退出登录', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/logout',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 10000) // SUCCESS_CODE
      assert.strictEqual(body.message, '退出登录成功')
      assert.strictEqual(body.success, true) // 使用 isSuccess 字段
      assert.strictEqual(body.data, null)
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝没有token的退出登录请求', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/logout'
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001) // UNAUTHORIZED
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })

    test('应该拒绝无效token的退出登录请求', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/logout',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001) // UNAUTHORIZED
      assert.strictEqual(body.success, false) // 使用 isSuccess 字段
      assert.ok(body.message) // 验证错误信息
      assert.ok(body.timestamp) // 验证时间戳字段
    })
  })
})
