/**
 * 响应格式测试文件
 */

import { test } from 'node:test'
import assert from 'node:assert'
import Fastify from 'fastify'
import responseFormatter from '../src/plugins/external/response-formatter.js'

interface TestUser {
  id: number
  name: string
  email: string
}

test('response formatter plugin', async (t) => {
  const fastify = Fastify()
  
  await fastify.register(responseFormatter)
  
  // 测试成功响应
  fastify.get('/success', async (request, reply) => {
    return reply.sendSuccess({ message: 'Hello World' })
  })
  
  // 测试创建响应
  fastify.post('/created', async (request, reply) => {
    return reply.sendCreated({ id: 1, name: 'Test' })
  })
  
  // 测试列表响应
  fastify.get('/list', async (request, reply) => {
    return reply.sendList([{ id: 1, name: 'Test' }])
  })
  
  // 测试分页响应
  fastify.get('/paginated', async (request, reply) => {
    return reply.sendPaginated([{ id: 1, name: 'Test' }], 100, 1, 10)
  })
  
  // 测试错误响应
  fastify.get('/error', async (request, reply) => {
    return reply.sendNotFound('Resource not found')
  })
  
  await t.test('should return success response with correct format', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/success'
    })
    
    assert.strictEqual(response.statusCode, 200)
    const body = JSON.parse(response.body)
    assert.strictEqual(body.code, 200)
    assert.strictEqual(body.message, '操作成功')
    assert.strictEqual(typeof body.timestamp, 'number')
    assert.strictEqual(typeof body.requestId, 'string')
    assert.strictEqual(body.data.message, 'Hello World')
  })
  
  await t.test('should return created response with correct format', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/created'
    })
    
    assert.strictEqual(response.statusCode, 201)
    const body = JSON.parse(response.body)
    assert.strictEqual(body.code, 201)
    assert.strictEqual(body.message, '创建成功')
    assert.strictEqual(body.data.id, 1)
  })
  
  await t.test('should return list response with correct format', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/list'
    })
    
    assert.strictEqual(response.statusCode, 200)
    const body = JSON.parse(response.body)
    assert.strictEqual(body.code, 200)
    assert.strictEqual(Array.isArray(body.data), true)
    assert.strictEqual(body.data.length, 1)
  })
  
  await t.test('should return paginated response with correct format', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/paginated'
    })
    
    assert.strictEqual(response.statusCode, 200)
    const body = JSON.parse(response.body)
    assert.strictEqual(body.code, 200)
    assert.strictEqual(typeof body.data, 'object')
    assert.strictEqual(Array.isArray(body.data.list), true)
    assert.strictEqual(body.data.total, 100)
    assert.strictEqual(body.data.page, 1)
    assert.strictEqual(body.data.pageSize, 10)
    assert.strictEqual(body.data.totalPages, 10)
    assert.strictEqual(body.data.hasNext, true)
    assert.strictEqual(body.data.hasPrev, false)
  })
  
  await t.test('should return error response with correct format', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/error'
    })
    
    assert.strictEqual(response.statusCode, 404)
    const body = JSON.parse(response.body)
    assert.strictEqual(body.code, 404)
    assert.strictEqual(body.message, '资源不存在')
    assert.strictEqual(body.data, null)
    assert.strictEqual(body.error.type, 'Error')
    assert.strictEqual(body.error.description, 'Resource not found')
  })
  
  await t.test('should include response time header', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/success'
    })
    
    assert.strictEqual(typeof response.headers['x-response-time'], 'string')
    assert.ok(response.headers['x-response-time'].endsWith('ms'))
  })
})

test('ResponseUtil class', async (t) => {
  const fastify = Fastify()
  
  fastify.get('/util/success', async (request, reply) => {
    const { ResponseUtil } = await import('../src/utils/response.js')
    return ResponseUtil.send(reply, request, { test: true }, 'Test message')
  })
  
  const response = await fastify.inject({
    method: 'GET',
    url: '/util/success'
  })
  
  assert.strictEqual(response.statusCode, 200)
  const body = JSON.parse(response.body)
  assert.strictEqual(body.message, 'Test message')
  assert.strictEqual(body.data.test, true)
})