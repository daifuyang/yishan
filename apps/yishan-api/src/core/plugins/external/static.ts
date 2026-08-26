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
  const uploadsRoot = join(process.cwd(), uploadDirNormalized)

  // Fastify-static 在 register 时会 stat 验证 root 是否存在。在 FC custom runtime
  // 里 /code 是只读 mount，public/uploads 不一定存在（取决于本次构建是否
  // 把上传目录一起打包）。如果不存在，让函数 boot 失败会暴露一个"用户上传
  // 文件之前函数就起不来"的脆弱耦合，违背"上层资源不影响下层可用"原则。
  //
  // 修复：try/catch 包住，root 不存在时降级：跳过 upload 路由的 serve，只保留
  // admin SPA 的 mount。后续真有用户上传需求时，业务代码（attachment.service.ts）
  // 再按 UPLOAD_DIR 显式 mkdir + write（write 不依赖 fastifyStatic 注册）。
  try {
    await fastify.register(fastifyStatic, {
      root: uploadsRoot,
      prefix,
      decorateReply: false
    })
  } catch (err) {
    fastify.log.warn(
      { err: (err as Error).message, uploadsRoot },
      'uploads root missing, fastify-static upload routes disabled (admin SPA still mounted)'
    )
  }

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
