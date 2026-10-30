import { createYishanApi, type ApiModule } from '@yishan/core-api'
import { createDatabase } from '@yishan/core-database'
import { createSystemRuntime, systemModule, type SystemRuntime } from '@yishan/core-system-api'
import { schema } from '@yishan/core-system-api/schema'
import { iximeiCrmModules } from './manifest'
import type { IximeiCrmConfig } from './config'

export interface IximeiCrmAppOptions {
  redis?: false | Record<string, unknown>
  staticAssets?: boolean
}

export async function buildApp(
  config: IximeiCrmConfig,
  modules: readonly ApiModule<SystemRuntime>[] = iximeiCrmModules,
  options: IximeiCrmAppOptions = {},
) {
  const database = createDatabase({ connection: config.connection, schema })
  try {
    const runtime = createSystemRuntime({
      database,
      config: config.system,
      ...options,
    })
    return await createYishanApi({
      modules: [systemModule, ...modules],
      context: runtime,
      permissionCatalog: runtime.permissions,
      runInContext: operation => runtime.run(operation),
      setup: async router => {
        await runtime.setup(router)
      },
      moduleState: runtime.moduleState,
      resources: [database],
      serverOptions: { logger: { level: config.system.APP_CONFIG.logLevel }, trustProxy: config.trustProxy },
    })
  } catch (error) {
    await database.close()
    throw error
  }
}
