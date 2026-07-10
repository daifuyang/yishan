import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import { join } from 'node:path'
import { STORAGE_CONFIG } from '../../../config/index.js'

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
    adminScope.get('/', async (_request, reply) => {
      return reply.sendFile('index.html')
    })
    adminScope.setNotFoundHandler(async (_request, reply) => {
      return reply.sendFile('index.html')
    })
  }, {
    prefix: '/admin'
  })

  // 根路径重定向到 /admin/，让 admin SPA 自己根据登录态决定显示 dashboard 或跳转登录页
  fastify.get('/', (_request, reply) => reply.redirect('/admin/', 301))
}, {
  name: 'static'
})
