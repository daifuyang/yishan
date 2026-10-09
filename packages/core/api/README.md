# Core API

Fastify host for explicitly declared modules. This package does not discover modules on disk or create database/system services.

```ts
import { createYishanApi } from '@yishan/core-api'
import { cookiePlugin, errorHandlerPlugin, swaggerPlugin } from '@yishan/core-api/plugins'

const app = await createYishanApi({
  modules: [systemModule, demoModule],
  context: runtime,
  permissionCatalog: runtime.permissions,
  runInContext: operation => runtime.run(operation),
  moduleState: runtime.moduleState,
  resources: [runtime.database],
  async setup(fastify) {
    await fastify.register(cookiePlugin)
    await fastify.register(errorHandlerPlugin, { production: true })
    await fastify.register(swaggerPlugin)
    await runtime.setup(fastify)
  },
})
await app.listen({ host: '0.0.0.0', port: 3100 })
```

The caller owns environment configuration, credentials, static resources and startup policy. `setup` runs after resource connection and before module registration; install authentication decorators before protected routes. The factory awaits readiness and module initialization, but does not listen.

Modules implement `ApiModule<Context>` from the shared `YishanModule` contract. The default prefix is `/api/<id>`; an explicit `prefix: ''` declares the root module, excluded from state synchronization and the enabled gate. Identifiers are lowercase letters, digits and underscores, at most 24 characters. Duplicate identifiers/prefixes, unsupported contract versions, invalid semver, missing dependencies and cycles fail before resource connection. Dependencies support semver ranges. Registration and initialization follow deterministic dependency order; shutdown reverses that order and closes all resources even if one close fails.

`FastifyInstance.moduleLoader` exposes `enabledIdsCached()`, `invalidateEnabledCache()`, `listModuleIds()`, `listMounted()` and `isMounted(id)`. State reads use an instance cache for one second. State synchronization receives business metadata only. Disabled modules respond with HTTP 404 / code 40400; missing routes respond with HTTP 404 / code 25005.

`permissionCatalog` is an instance-owned `PermissionCatalog`. Its `register`, `has`, `codes` and `listPermissions` methods expose immutable definition snapshots. `runWithPermissions` / `currentPermissionCatalog` and the legacy permission facade read the current application scope. The factory scopes registration, request continuations and shutdown, composing the optional `runInContext` callback with the permission scope. Declare permissions as readonly data at module scope; register them during module registration.

Public exports: the package root, `./plugins`, `./errors`, `./response`, `./business-codes` and its code modules, `./permissions/catalog`, and `./routes/route-registrar`. All exports resolve to CommonJS JavaScript and declaration files under `dist`.

```sh
pnpm --filter @yishan/core-api test
pnpm --filter @yishan/core-api typecheck
```
