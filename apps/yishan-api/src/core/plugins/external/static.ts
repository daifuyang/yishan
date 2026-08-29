import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import { ADMIN } from '../../../config/admin.js'
import { STORAGE } from '../../../config/storage.js'

/**
 * 静态资源 + Admin SPA 装配。
 *
 * 设计要点（按第一性原理）：
 * 1) 启动期 fs.access 探测 uploads 目录是否可读 → 决定是否挂静态路由；
 *    插件本身不做"边 register 边 try/catch"的混合职责。
 * 2) 路径规整、URL prefix、admin mount 模式全部由 config 边界层产出；
 *    插件只读字段，不做字符串推断。
 * 3) SPA fallback 只在 admin prefix 范围内生效（嵌套 register），
 *    不动全局 setNotFoundHandler，避免覆盖 app.ts 的 envelope 404 handler。
 */
export default fp(async (fastify) => {
  // ─── 1. uploads 静态资源（可选挂载；目录缺失则降级） ───────────
  if (STORAGE.isPublic) {
    const canServe = await canReadDir(STORAGE.diskRoot)
    if (canServe) {
      await fastify.register(fastifyStatic, {
        root: STORAGE.diskRoot,
        prefix: STORAGE.urlPrefix,
        decorateReply: false,
      })
    } else {
      fastify.log.warn(
        { root: STORAGE.diskRoot },
        'uploads dir missing or unreadable; static route skipped (writes still work via attachment.service)'
      )
    }
  }

  // ─── 2. admin SPA（必挂；静态资源 + prefix 范围内的 SPA fallback） ─
  const adminPrefix = ADMIN.mount.mode === 'root' ? '/' : ADMIN.mount.path
  await fastify.register(async (adminScope) => {
    await adminScope.register(fastifyStatic, {
      root: ADMIN.diskPath,
      prefix: '/',
      index: false,
      decorateReply: false,
    })
    adminScope.setNotFoundHandler(async (_request, reply) => {
      return reply.sendFile('index.html', ADMIN.diskPath)
    })
  }, { prefix: adminPrefix })

  // ─── 3. 生产环境根路径 301 重定向到 admin 入口（仅 subpath 模式） ─
  if (process.env.NODE_ENV === 'production' && ADMIN.mount.mode === 'subpath' && ADMIN.redirectRoot) {
    const target = ADMIN.mount.path.endsWith('/') ? ADMIN.mount.path : `${ADMIN.mount.path}/`
    fastify.get('/', (_request, reply) => reply.redirect(target, 301))
  }
}, {
  name: 'static',
})

async function canReadDir(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}
