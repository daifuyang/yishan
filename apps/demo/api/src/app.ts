import { createYishanApi, type ApiModule } from '@yishan/core-api'
import { createDatabase } from '@yishan/core-database'
import { createSystemRuntime, systemModule, type SystemRuntime } from '@yishan/core-system-api'
import { schema } from '@yishan/core-system-api/schema'
import { demoModules } from './manifest'
import type { DemoConfig } from './config'
import { DemoUserProfiles } from './extensions/user-profile.repository'
import { createDemoUserExtension } from './extensions/user-profile'
import { registerDemoProfile } from './extensions/user-profile.routes'
import { registerModuleAdministration } from './dev/module-administration'
import { ActionDraftService } from './modules/ai/services/action-draft.service'
import { ActionDraftRepository } from './modules/ai/repositories/action-draft.repository'
import { AiAuditRepository } from './modules/ai/repositories/ai-audit.repository'
import { AiUserCreationParticipant } from './modules/ai/services/user-creation-participant'

export interface DemoAppOptions {
  redis?: false | Record<string, unknown>
  staticAssets?: boolean
}

export async function buildApp(config: DemoConfig, modules: readonly ApiModule<SystemRuntime>[] = demoModules, options: DemoAppOptions = {}) {
  const database = createDatabase({ connection: config.connection, schema })
  try {
    const profiles = new DemoUserProfiles(database.db)
    const runtime = createSystemRuntime({ database, config: config.system, ...options,
      extensions: modules.some(module => module.id === 'demo') ? [createDemoUserExtension(profiles)] : [],
      // 草稿关联创建的**唯一**注入点。AI 模块缺席时这里是 undefined，System 照常支持
      // 普通创建；而带 draftSubmission 的请求会被拒绝而不是降级 —— 只有真正装上了
      // 能兑现「同一草稿只创建一次」的模块，才允许声明这次创建来自草稿。
      userCreationParticipant: modules.some(module => module.id === 'ai')
        ? new AiUserCreationParticipant(
            new ActionDraftService(new ActionDraftRepository(database.db)),
            new AiAuditRepository(database.db),
          )
        : undefined,
    })
    const installed = modules.map(module => module.id === 'demo' ? {
      ...module,
      async register(router: Parameters<typeof module.register>[0], context: SystemRuntime) {
        await module.register(router, context)
        registerDemoProfile(router, context, profiles)
      },
    } : module)
    return await createYishanApi({
      modules: [systemModule, ...installed],
      context: runtime,
      permissionCatalog: runtime.permissions,
      runInContext: operation => runtime.run(operation),
      setup: async router => {
        await runtime.setup(router)
        if (config.system.APP_CONFIG.nodeEnv === 'development') registerModuleAdministration(router, runtime, installed)
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
