import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import { join } from 'node:path'
import { ADMIN_BASE_PATH, ADMIN_CONFIG, STORAGE_CONFIG } from '../../../config/index.js'

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
    prefix: ADMIN_BASE_PATH
  })

  // 生产环境根路径进入 Admin SPA；开发态保留根路径，避免调试 API 时被重定向。
  // 部署到 fc + CDN 时通常会把 admin 编译成 /admin/ 前缀，需要把根路径重定向过去；
  // 通过 ADMIN_BASE_PATH 与 ADMIN_REDIRECT_ROOT 一起控制（默认 /admin、默认开启重定向）。
  if (process.env.NODE_ENV === 'production' && ADMIN_CONFIG.redirectRoot) {
    const target = ADMIN_BASE_PATH === '/' ? '/admin/' : `${ADMIN_BASE_PATH}/`
    fastify.get('/', (_request, reply) => reply.redirect(target, 301))
  }
}, {
  name: 'static'
})
