import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import type { ModuleStateStore, ResourceLifecycle } from '@yishan/core-contracts'
import { ModuleLoader, moduleRoutePrefix, orderModules, type ApiModule } from './module-loader'
import { PermissionCatalog } from './permission-catalog'
import { runWithPermissions } from './permissions/catalog'

export interface CreateYishanApiOptions<Context> {
  readonly modules: readonly ApiModule<Context>[]
  readonly context: Context
  readonly serverOptions?: FastifyServerOptions
  readonly setup?: (fastify: FastifyInstance) => Promise<void>
  readonly runInContext?: <T>(fn: () => T) => T
  readonly moduleState?: ModuleStateStore
  readonly resources?: readonly ResourceLifecycle[]
  readonly permissionCatalog?: PermissionCatalog
}

declare module 'fastify' {
  interface FastifyInstance {
    moduleLoader: ModuleLoader
    permissionCatalog: PermissionCatalog
  }
}

function failure(code: number, message: string) {
  return { success: false, code, message, data: null, timestamp: new Date().toISOString() }
}

export async function createYishanApi<Context>(options: CreateYishanApiOptions<Context>): Promise<FastifyInstance> {
  const modules = orderModules(options.modules)
  const catalog = options.permissionCatalog ?? new PermissionCatalog()
  const run = <T>(fn: () => T): T => options.runInContext
    ? options.runInContext(() => runWithPermissions(catalog, fn))
    : runWithPermissions(catalog, fn)
  const app = run(() => Fastify(options.serverOptions))
  const loader = new ModuleLoader(modules, options.moduleState)
  app.decorate('moduleLoader', loader)
  app.decorate('permissionCatalog', catalog)
  const resources: ResourceLifecycle[] = []
  const activated: ApiModule<Context>[] = []
  let closed = false
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    const errors: unknown[] = []
    for (const module of [...activated].reverse()) {
      try { await run(() => module.close?.(options.context)) } catch (error) { errors.push(error) }
    }
    for (const resource of [...resources].reverse()) {
      try { await run(() => resource.close()) } catch (error) { errors.push(error) }
    }
    if (errors.length) throw new AggregateError(errors, 'API resource cleanup failed')
  }
  app.addHook('preClose', done => run(done))
  app.addHook('onListen', done => run(done))
  app.addHook('onClose', close)
  // Calling done inside the scope carries async-local context through Fastify's request chain.
  app.addHook('onRequest', (_request, _reply, done) => run(done))
  app.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0]
    const module = modules.find(candidate => moduleRoutePrefix(candidate) !== '' && (
      pathname === moduleRoutePrefix(candidate) || pathname.startsWith(`${moduleRoutePrefix(candidate)}/`)
    ))
    if (module && !(await loader.enabledIdsCached()).has(module.id)) {
      return reply.code(404).send(failure(40400, `模块未启用：${module.id}`))
    }
  })
  app.addHook('onRoute', route => {
    const code = route.schema?.['x-permission-code']
    if (code === undefined) return
    const label = route.schema?.['x-permission-label']
    const group = route.schema?.['x-permission-group']
    if (typeof code !== 'string' || typeof label !== 'string' || typeof group !== 'string') throw new Error('Route permission metadata requires code, label and group')
    const existing = catalog.listPermissions().find(permission => permission.code === code)
    if (existing && (existing.label !== label || existing.group !== group)) throw new Error(`inconsistent permission declaration: ${code}`)
    if (!existing) catalog.register({ code, label, group })
  })
  app.setNotFoundHandler((request, reply) => reply.code(404).send(failure(25005, `Route ${request.method}:${request.url} not found`)))
  try {
    await run(async () => {
      for (const resource of options.resources ?? []) {
        resources.push(resource)
        await resource.connect?.()
      }
      await options.setup?.(app)
      await options.moduleState?.sync(modules.filter(module => moduleRoutePrefix(module) !== '').map(({ id, name, version, tablePrefix }) => ({ id, name, version, tablePrefix })))
      for (const module of modules) {
        activated.push(module)
        await app.register(async router => {
          if (moduleRoutePrefix(module) !== '') {
            // Route ownership also gates normalized URLs and custom router matching options.
            router.addHook('onRequest', async (_request, reply) => {
              if (!(await loader.enabledIdsCached()).has(module.id)) {
                return reply.code(404).send(failure(40400, `模块未启用：${module.id}`))
              }
            })
          }
          await module.register(router, options.context)
          loader.markMounted(module.id)
        }, { prefix: moduleRoutePrefix(module) })
      }
      await app.ready()
      for (const module of modules) await module.initialize?.(options.context)
    })
    return app
  } catch (error) {
    try { await app.close() } catch (cleanupError) { app.log.error(cleanupError, 'API cleanup failed') }
    try { await close() } catch (cleanupError) { app.log.error(cleanupError, 'API cleanup failed') }
    throw error
  }
}
