import { FastifyPluginAsync } from 'fastify'
import { dateUtils } from '../utils/date.js'

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', async function (request, reply) {
    return {
      status: 'ok',
      message: 'Service is healthy',
      timestamp: dateUtils.now(),
      version: process.env.npm_package_version || '1.0.0'
    }
  })
}

export default root
