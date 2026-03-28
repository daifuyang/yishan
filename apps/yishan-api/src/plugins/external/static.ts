import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import { join } from 'node:path'
import { STORAGE_CONFIG } from '../../config/index.js'

export default fp(async (fastify) => {
  const uploadDirNormalized = STORAGE_CONFIG.uploadDir.replace(/\\/g, '/').replace(/^\/+/, '')
  const urlBase = uploadDirNormalized.startsWith('public/')
    ? `/${uploadDirNormalized.slice('public/'.length)}`
    : `/${uploadDirNormalized}`
  const prefix = `${urlBase.replace(/\/+$/g, '')}/`
  const adminDistPath = join(process.cwd(), 'public', 'admin')

  await fastify.register(fastifyStatic, {
    root: join(process.cwd(), uploadDirNormalized),
    prefix,
    decorateReply: false
  })

  await fastify.register(async (adminScope) => {
    await adminScope.register(fastifyStatic, {
      root: adminDistPath,
      prefix: '/',
      index: false
    })
    adminScope.setNotFoundHandler(async (_request, reply) => {
      return reply.sendFile('index.html')
    })
  }, {
    prefix: '/admin'
  })
}, {
  name: 'static'
})
