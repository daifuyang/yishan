import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import Fastify from 'fastify'
import serviceApp from '../src/app.js'
import { FastifyInstance } from 'fastify'
import { config } from 'dotenv'
import path from 'node:path'

describe('Admin API Tests', () => {
  let app: FastifyInstance
  let validAccessToken: string

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

    // 获取有效的访问令牌用于认证测试
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/login',
      payload: {
        username: 'admin',
        password: 'admin123'
      }
    })

    if (loginResponse.statusCode === 200) {
      const loginBody = JSON.parse(loginResponse.body)
      validAccessToken = loginBody.data.accessToken
    }
  })

  after(async () => {
    // 清理资源
    await app.close()
  })

  describe('GET /api/v1/admin', () => {
    test('应该成功访问管理员首页（有效的JWT令牌）', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin',
        headers: {
          authorization: `Bearer ${validAccessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 10000) // 统一成功码
      assert.strictEqual(body.message, '访问成功')
      assert.ok(body.data)
      assert.strictEqual(body.data.message, 'hello admin')
    })

    test('应该拒绝未提供认证令牌的请求', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin'
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001)
      assert.ok(body.message.includes('Authorization头缺失或格式错误'))
    })

    test('应该拒绝无效的JWT令牌', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin',
        headers: {
          authorization: 'Bearer invalid-token-here'
        }
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001)
      assert.ok(body.message.includes('无效的token') || body.message.includes('未授权'))
    })

    test('应该拒绝格式错误的Authorization头', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin',
        headers: {
          authorization: 'InvalidFormat token-here'
        }
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001)
      assert.ok(body.message.includes('Authorization头缺失或格式错误'))
    })

    test('应该拒绝空的Authorization头', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin',
        headers: {
          authorization: ''
        }
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001)
      assert.ok(body.message.includes('Authorization头缺失或格式错误'))
    })

    test('应该拒绝过期的JWT令牌', async () => {
      // 使用一个已知过期的令牌（这里使用一个模拟的过期令牌）
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB5aXNoYW4uY29tIiwidXNlcm5hbWUiOiJhZG1pbiIsInJlYWxfbmFtZSI6IueuoeeQhuWRmCIsInN0YXR1cyI6MSwidHlwZSI6ImFjY2VzcyIsImp0aSI6IjEtMTczNTU1NTU1NS1hYmNkZWZnaCIsImlhdCI6MTczNTU1NTU1NSwiZXhwIjoxNzM1NTU1NTU2fQ.invalid-signature'
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin',
        headers: {
          authorization: `Bearer ${expiredToken}`
        }
      })

      assert.strictEqual(response.statusCode, 401)
      
      const body = JSON.parse(response.body)
      assert.ok([22001, 22002].includes(body.code))
      assert.ok(body.message.includes('无效的token') || body.message.includes('过期'))
    })

    test('应该正确处理Bearer令牌格式（大小写敏感）', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin',
        headers: {
          authorization: `bearer ${validAccessToken}`
        }
      })

      // Bearer必须大小写匹配，否则按未授权处理
      assert.strictEqual(response.statusCode, 401)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 22001)
    })

    test('应该返回正确的响应格式和数据类型', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin',
        headers: {
          authorization: `Bearer ${validAccessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      
      const body = JSON.parse(response.body)
      
      // 验证响应结构
      assert.ok(typeof body.code === 'number')
      assert.ok(typeof body.message === 'string')
      assert.ok(typeof body.data === 'object')
      assert.ok(body.data !== null)
      
      // 验证数据内容
      assert.ok(typeof body.data.message === 'string')
      assert.strictEqual(body.data.message, 'hello admin')
    })
  })
})
