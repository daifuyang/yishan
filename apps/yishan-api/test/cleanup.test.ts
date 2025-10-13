import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import Fastify from 'fastify'
import serviceApp from '../src/app.js'
import { FastifyInstance } from 'fastify'
import { config } from 'dotenv'
import path from 'node:path'

describe('System Cleanup API Tests', () => {
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
    await app.close()
  })

  describe('POST /api/v1/system/cleanup/tokens', () => {
    test('应该成功执行Token清理（有效的清理密钥）', async () => {
      const validCleanupKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': validCleanupKey
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 200)
      assert.strictEqual(body.code, 20000)
      assert.strictEqual(body.message, 'Token清理完成')
      assert(typeof body.data === 'object')
      assert(typeof body.data.deletedCount === 'number')
      assert(typeof body.data.executionTime === 'string')
      assert(typeof body.data.timestamp === 'string')
      assert(body.data.executionTime.endsWith('ms'))
      assert(new Date(body.data.timestamp).getTime() > 0) // 验证时间戳格式
    })

    test('应该拒绝无效的清理密钥', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': 'invalid-key'
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 400)
      assert.strictEqual(body.code, 40002)
      assert.strictEqual(body.message, '无效的清理密钥')
    })

    test('应该拒绝缺失清理密钥的请求', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {}
      })

      // Fastify schema验证失败时返回400状态码
      assert.strictEqual(response.statusCode, 400)
      
      // 验证响应体包含错误信息
      const body = JSON.parse(response.body)
      assert.ok(body.message)
    })

    test('应该拒绝空字符串清理密钥', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': ''
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 400)
      assert.strictEqual(body.code, 40002)
      assert.strictEqual(body.message, '无效的清理密钥')
    })

    test('应该拒绝null值清理密钥', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': null as any
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 400)
      assert.strictEqual(body.code, 40002)
      assert.strictEqual(body.message, '无效的清理密钥')
    })

    test('应该正确处理大小写敏感的密钥验证', async () => {
      const validCleanupKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      const uppercaseKey = validCleanupKey.toUpperCase()
      
      // 如果原密钥不是全大写，则大写版本应该被拒绝
      if (validCleanupKey !== uppercaseKey) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/system/cleanup/tokens',
          headers: {
            'x-cleanup-key': uppercaseKey
          }
        })

        const body = JSON.parse(response.body)
        
        assert.strictEqual(response.statusCode, 400)
        assert.strictEqual(body.code, 40002)
        assert.strictEqual(body.message, '无效的清理密钥')
      }
    })

    test('应该正确处理包含特殊字符的密钥', async () => {
      const specialKey = 'test-key-with-special-chars-!@#$%^&*()'
      
      // 临时设置特殊字符密钥
      const originalKey = process.env.CLEANUP_API_KEY
      process.env.CLEANUP_API_KEY = specialKey
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': specialKey
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 200)
      assert.strictEqual(body.code, 20000)
      assert.strictEqual(body.message, 'Token清理完成')
      
      // 恢复原始密钥
      process.env.CLEANUP_API_KEY = originalKey
    })

    test('应该返回正确的执行时间格式', async () => {
      const validCleanupKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': validCleanupKey
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 200)
      assert(body.data.executionTime.match(/^\d+ms$/), '执行时间格式应为数字+ms')
      
      const executionTimeMs = parseInt(body.data.executionTime.replace('ms', ''))
      assert(executionTimeMs >= 0, '执行时间应为非负数')
    })

    test('应该返回有效的ISO时间戳', async () => {
      const validCleanupKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      
      const beforeRequest = new Date()
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': validCleanupKey
        }
      })

      const afterRequest = new Date()
      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 200)
      
      const timestamp = new Date(body.data.timestamp)
      assert(timestamp >= beforeRequest, '时间戳应该在请求时间之后')
      assert(timestamp <= afterRequest, '时间戳应该在响应时间之前')
      assert(body.data.timestamp.includes('T'), '时间戳应为ISO格式')
      assert(body.data.timestamp.includes('Z') || body.data.timestamp.includes('+') || body.data.timestamp.includes('-'), '时间戳应包含时区信息')
    })

    test('应该返回非负的删除计数', async () => {
      const validCleanupKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': validCleanupKey
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 200)
      assert(body.data.deletedCount >= 0, '删除计数应为非负整数')
      assert(Number.isInteger(body.data.deletedCount), '删除计数应为整数')
    })
  })

  describe('GET /api/v1/system/cleanup/status', () => {
    test('应该成功获取清理状态（有效的清理密钥）', async () => {
      const validCleanupKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/system/cleanup/status',
        headers: {
          'x-cleanup-key': validCleanupKey
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 200)
      assert.strictEqual(body.code, 20000)
      assert.strictEqual(body.message, '获取清理状态成功')
      assert.ok(body.data)
      assert.ok(typeof body.data.totalTokens === 'number')
      assert.ok(typeof body.data.expiredTokens === 'number')
      assert.ok(typeof body.data.revokedTokens === 'number')
      assert.ok(body.data.lastCleanupTime === null || typeof body.data.lastCleanupTime === 'string')
      // 移除对executionTime和timestamp的检查，因为这些字段在status API中不存在
      // assert.ok(typeof body.data.executionTime === 'number')
      // assert.ok(typeof body.data.timestamp === 'string')
    })

    test('应该拒绝无效的清理密钥', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/system/cleanup/status',
        headers: {
          'x-cleanup-key': 'invalid-key'
        }
      })

      const body = JSON.parse(response.body)
      
      assert.strictEqual(response.statusCode, 400)
      assert.strictEqual(body.code, 40002)
      assert.strictEqual(body.message, '无效的清理密钥')
    })

    test('应该拒绝缺失清理密钥的请求', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/system/cleanup/status',
        headers: {}
      })

      // Fastify schema验证失败时返回400状态码
      assert.strictEqual(response.statusCode, 400)
      
      // 验证响应体包含错误信息
      const body = JSON.parse(response.body)
      assert.ok(body.message)
    })
  })

  describe('清理逻辑集成测试', () => {
    test('应该在执行清理后更新状态信息', async () => {
      const validCleanupKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key-change-this'
      
      // 先获取清理前的状态
      const statusBeforeResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/system/cleanup/status',
        headers: {
          'x-cleanup-key': validCleanupKey
        }
      })

      const statusBefore = JSON.parse(statusBeforeResponse.body)
      
      // 执行清理
      const cleanupResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/system/cleanup/tokens',
        headers: {
          'x-cleanup-key': validCleanupKey
        }
      })

      const cleanupResult = JSON.parse(cleanupResponse.body)
      
      // 再次获取状态
      const statusAfterResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/system/cleanup/status',
        headers: {
          'x-cleanup-key': validCleanupKey
        }
      })

      const statusAfter = JSON.parse(statusAfterResponse.body)
      
      // 验证清理执行成功
      assert.strictEqual(cleanupResponse.statusCode, 200)
      assert.strictEqual(cleanupResult.code, 20000)
      
      // 验证状态查询成功
      assert.strictEqual(statusAfterResponse.statusCode, 200)
      assert.strictEqual(statusAfter.code, 20000)
      
      // 验证清理后的状态变化（如果有删除操作）
      if (cleanupResult.data.deletedCount > 0) {
        // 如果有删除操作，总token数应该减少
        assert(statusAfter.data.totalTokens <= statusBefore.data.totalTokens)
      }
      
      // 验证清理结果的数据结构
      assert.ok(cleanupResult.data)
      assert.ok(typeof cleanupResult.data.deletedCount === 'number')
      assert.ok(typeof cleanupResult.data.executionTime === 'string')
      assert.ok(typeof cleanupResult.data.timestamp === 'string')
      
      // 验证状态数据的一致性
      assert.ok(statusAfter.data)
      assert.ok(typeof statusAfter.data.totalTokens === 'number')
      assert.ok(typeof statusAfter.data.expiredTokens === 'number')
      assert.ok(typeof statusAfter.data.revokedTokens === 'number')
      
      // 验证清理操作确实执行了（删除数量应该大于等于0）
      assert.ok(cleanupResult.data.deletedCount >= 0)
      
      // 验证执行时间格式（应该是"XXXms"格式）
      assert.ok(cleanupResult.data.executionTime.endsWith('ms'))
      const executionTimeValue = parseInt(cleanupResult.data.executionTime.replace('ms', ''))
      assert.ok(executionTimeValue >= 0)
    })
  })
})