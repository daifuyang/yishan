import { eq, inArray } from 'drizzle-orm'
import type { SystemDatabase } from '../../db'
import { sysModule } from '../../db/schema'

export class ModuleRepository {
  constructor(private readonly database: SystemDatabase) {}

  async list(ids: readonly string[]) {
    if (ids.length === 0) return []
    return this.database.db.select({ id: sysModule.id, name: sysModule.name, tablePrefix: sysModule.tablePrefix,
      version: sysModule.version, enabled: sysModule.enabled }).from(sysModule).where(inArray(sysModule.id, [...ids]))
  }

  async setEnabled(id: string, enabled: boolean): Promise<{ previous: boolean } | undefined> {
    return this.database.transaction(async tx => {
      const [existing] = await tx.select({ enabled: sysModule.enabled }).from(sysModule).where(eq(sysModule.id, id)).for('update')
      if (!existing) return undefined
      await tx.update(sysModule).set({ enabled: enabled ? 1 : 0 }).where(eq(sysModule.id, id))
      return { previous: existing.enabled === 1 }
    })
  }
}
