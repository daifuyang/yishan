import type { SystemRuntime } from './runtime'
import { ModuleRepository } from './core/repositories/module.repository'

export interface InstalledModule {
  id: string
  name: string
  tablePrefix: string
  version: string
  enabled: boolean
}

export function createModuleAdministration(runtime: SystemRuntime) {
  const repository = new ModuleRepository(runtime.database)
  return {
    async list(ids: readonly string[]): Promise<InstalledModule[]> {
      const rows = await repository.list(ids)
      return rows.map(row => ({ ...row, enabled: row.enabled === 1 }))
    },
    setEnabled(id: string, enabled: boolean): Promise<{ previous: boolean } | undefined> {
      return repository.setEnabled(id, enabled)
    },
  }
}
