# @yishan/core-system-api

System API owns `sys_*` tables, system routes, user identity, JWT/PAT session checks, RBAC, storage settings and system seeds. Products provide their configuration and database explicitly. Importing the package creates no connections and reads no environment variables.

```ts
const config = createSystemConfig(env, productRoot)
const database = createDatabase({ connection, schema })
const runtime = createSystemRuntime({ database, config, extensions })
const app = await createYishanApi({
  modules: [systemModule, ...productModules],
  context: runtime,
  permissionCatalog: runtime.permissions,
  runInContext: operation => runtime.run(operation),
  setup: router => runtime.setup(router),
  moduleState: runtime.moduleState,
  resources: [database],
})
```

The product owns resources and their shutdown. Maintenance commands and repositories using the `./database` facade must execute within `runtime.run()`. Operations without a runtime scope fail; there is no fallback database or default runtime. Caches and permission declarations belong to each runtime. Redis keys include the configured cache namespace.

Use `userDirectory` for identities and `users.create/update` for user mutations. Extension validation runs before persistence. Notification failures after a successful write are reported through `onExtensionError`; they do not turn a saved operation into a failed request. Historical identity lookups can explicitly request `includeDeleted: true` and return only identity fields.

Products contribute seeds through `seedModuleMenus(moduleId, nodes)`, `seedModuleEnums(moduleId, items)` and `purgeModuleSeedDeclarations(moduleId, declarations)`. Each contribution is restricted to the module's menu path, permission and enum prefixes. Pathless button declarations bind to their nearest page ancestor. Call these APIs within the runtime scope. `seedSystem()` seeds system data only; the product command coordinates migration and module seeds.

`systemModule.migrations` points at the packaged migration journal and SQL files. Build copies these files and seed JSON into `dist`. Migration application remains an explicit operator command. Development engineering endpoints belong to the product and are not mounted by this package.

Run `pnpm --filter @yishan/core-system-api build` or `pnpm --filter @yishan/core-system-api test`. Tests preserve the existing system regressions and verify the compiled package's simultaneous-instance isolation, request authorization, lifecycle, extensions and seed ownership.
