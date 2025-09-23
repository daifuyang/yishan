/**
 * Fastify响应格式化插件
 * 统一处理所有响应格式
 */

import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { decorateReply } from '../../utils/response.js'

/**
 * 响应格式化插件
 */
export default fp(async function (fastify: FastifyInstance) {
  // 为reply添加响应方法
  decorateReply(fastify)

  // 不设置错误处理器和404处理器，因为app.ts中已经有一个

  // 添加响应时间头
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Response-Time', `${reply.elapsedTime}ms`)
  })

}, {
  name: 'response-formatter',
  fastify: '5.x'
})