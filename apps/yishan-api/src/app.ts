import 'dotenv/config'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { assertJwtSecretOrThrow } from './core/plugins/external/jwt-secret-validator.js'

/**
 * Section 2 安全门禁：生产环境使用默认 / 弱 JWT secret 直接拒绝启动。
 * 本地开发与 CI 环境（NODE_ENV ≠ production）只警告，不阻塞。
 */
try {
  const check = assertJwtSecretOrThrow()
  if (!check.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[startup] ${check.reason ?? 'weak JWT secret'}; allow because NODE_ENV != production. Set JWT_SECRET to a strong secret.`)
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error((err as Error).message)
  process.exit(1)
}

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}
const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  // 1. External Fastify plugins (cors / jwt / redis / multipart / ...) — registered first
  //    so application routes can rely on their decorators and preHandlers.
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/plugins/external'),
    options: {},
  })

  // 2. Reusable application helpers shared across routes.
  fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/plugins/app'),
    options: { ...opts },
  })

  // 3. Module autoload — scans `src/modules/*/routes.ts`. Each module exports
  //    `meta` (id, name, defaultEnabled, prefix) and a default Fastify plugin.
  //    `.dev-modules.json` overrides the default on a per-developer basis in
  //    non-production environments; production never reads it.
  const modulesDir = join(__dirname, 'modules')
  if (existsSync(modulesDir)) {
    const devOverridePath = join(process.cwd(), '.dev-modules.json')
    const overrides: Record<string, boolean> =
      process.env.NODE_ENV !== 'production' && existsSync(devOverridePath)
        ? (JSON.parse(readFileSync(devOverridePath, 'utf8')) as Record<string, boolean>)
        : {}

    for (const id of readdirSync(modulesDir)) {
      const moduleDir = join(modulesDir, id)
      if (!statSync(moduleDir).isDirectory()) continue

      const routesEntry = join(moduleDir, 'routes.js')
      if (!existsSync(routesEntry)) {
        fastify.log.warn({ module: id }, 'module skipped: routes.js missing')
        continue
      }

      const mod = await import(routesEntry)
      const meta = (mod as { meta?: { id?: unknown; defaultEnabled?: unknown; prefix?: unknown } }).meta
      if (!meta || typeof meta.id !== 'string') {
        fastify.log.warn({ module: id }, 'module skipped: meta.id missing')
        continue
      }

      const enabled = overrides[meta.id] ?? Boolean(meta.defaultEnabled)
      if (!enabled) {
        fastify.log.info({ module: meta.id }, 'module skipped')
        continue
      }

      const prefix = typeof meta.prefix === 'string' && meta.prefix.length > 0
        ? meta.prefix
        : `/api/${meta.id}`

      await fastify.register(AutoLoad, {
        dir: moduleDir,
        options: { ...opts, prefix },
      })
      fastify.log.info({ module: meta.id, prefix }, 'module mounted')
    }
  }

  // 4. Core HTTP routes — single source of truth for in-app endpoints.
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/routes'),
    autoHooks: true,
    cascadeHooks: true,
    options: opts,
  })
}

export default app
export { app, options }