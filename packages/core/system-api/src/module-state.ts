import { eq } from 'drizzle-orm'
import type { ModuleStateStore } from '@yishan/core-contracts'
import type { SystemRuntime } from './runtime'
import { sysModule } from './db/schema'

export function createModuleStateStore(runtime: SystemRuntime): ModuleStateStore {
  return {
    async sync(modules) {
      for (const module of modules) {
        await runtime.database.db.insert(sysModule).values({ id: module.id, name: module.name, version: module.version, tablePrefix: module.tablePrefix })
          .onDuplicateKeyUpdate({ set: { name: module.name, version: module.version, tablePrefix: module.tablePrefix } })
      }
    },
    async enabledIds() {
      const rows = await runtime.database.db.select({ id: sysModule.id }).from(sysModule).where(eq(sysModule.enabled, 1))
      return new Set(rows.map(row => row.id))
    },
  }
}
