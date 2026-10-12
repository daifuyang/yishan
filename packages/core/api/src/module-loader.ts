import type { FastifyInstance } from 'fastify'
import type { ModuleMetadata, ModuleStateStore, YishanModule } from '@yishan/core-contracts'
import { satisfies, valid, validRange } from 'semver'

export type ApiModule<Context = unknown> = YishanModule<FastifyInstance, Context>

export function moduleRoutePrefix(module: Pick<ApiModule, 'id' | 'prefix'>): string {
  return module.prefix ?? `/api/${module.id}`
}

export function orderModules<Context>(modules: readonly ApiModule<Context>[]): readonly ApiModule<Context>[] {
  const byId = new Map<string, ApiModule<Context>>()
  const prefixes = new Set<string>()
  for (const module of modules) {
    if (!module || typeof module !== 'object' || typeof module.id !== 'string'
      || typeof module.name !== 'string' || !module.name.trim() || typeof module.tablePrefix !== 'string') {
      throw new Error('invalid module definition: metadata is required')
    }
    if (!/^[a-z0-9_]{1,24}$/.test(module.id)) throw new Error(`invalid module id: ${module.id}`)
    if (!/^[a-z][a-z0-9_]*_$/.test(module.tablePrefix)) throw new Error(`invalid module definition: table prefix ${module.id}`)
    if (byId.has(module.id)) throw new Error(`duplicate module id: ${module.id}`)
    if (module.contractVersion !== 2) throw new Error(`unsupported module contract: ${module.id}`)
    if (!valid(module.version)) throw new Error(`invalid module version: ${module.id}/${module.version}`)
    if (typeof module.register !== 'function') throw new Error(`module register is required: ${module.id}`)
    for (const lifecycle of ['initialize', 'close', 'seed'] as const) {
      if (module[lifecycle] !== undefined && typeof module[lifecycle] !== 'function') {
        throw new Error(`invalid module lifecycle: ${module.id}/${lifecycle}`)
      }
    }
    if (module.dependencies !== undefined && (!Array.isArray(module.dependencies)
      || module.dependencies.some(dependency => !dependency || typeof dependency.id !== 'string'
        || (dependency.version !== undefined && typeof dependency.version !== 'string')))) {
      throw new Error(`invalid module dependencies: ${module.id}`)
    }
    if (module.migrations !== undefined && (!module.migrations || typeof module.migrations !== 'object'
      || module.migrations.id !== module.id || typeof module.migrations.folder !== 'string' || !module.migrations.folder.trim()
      || typeof module.migrations.historyTable !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(module.migrations.historyTable))) {
      throw new Error(`invalid module migrations: ${module.id}`)
    }
    const prefix = moduleRoutePrefix(module)
    if (typeof prefix !== 'string' || (prefix && (!prefix.startsWith('/') || prefix.endsWith('/') || /[?#]/.test(prefix)))) {
      throw new Error(`invalid module prefix: ${module.id}/${prefix}`)
    }
    if (prefixes.has(prefix)) throw new Error(`duplicate module prefix: ${prefix}`)
    if (prefix && [...prefixes].some(existing => existing && (
      prefix.startsWith(`${existing}/`) || existing.startsWith(`${prefix}/`)
    ))) throw new Error(`overlapping module prefix: ${prefix}`)
    prefixes.add(prefix)
    byId.set(module.id, module)
  }
  const ordered: ApiModule<Context>[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (module: ApiModule<Context>): void => {
    if (visited.has(module.id)) return
    if (visiting.has(module.id)) throw new Error(`module dependency cycle: ${module.id}`)
    visiting.add(module.id)
    for (const dependency of [...(module.dependencies ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
      const target = byId.get(dependency.id)
      if (!target) throw new Error(`missing module dependency: ${module.id} -> ${dependency.id}`)
      if (dependency.version && (!validRange(dependency.version) || !satisfies(target.version, dependency.version))) {
        throw new Error(`module dependency version mismatch: ${module.id} -> ${dependency.id}@${dependency.version}`)
      }
      visit(target)
    }
    visiting.delete(module.id)
    visited.add(module.id)
    ordered.push(module)
  }
  for (const module of [...modules].sort((a, b) => a.id.localeCompare(b.id))) visit(module)
  return Object.freeze(ordered)
}

export class ModuleLoader {
  private readonly ids: ReadonlySet<string>
  private readonly mounted = new Set<string>()
  private enabledMemo?: { ids: ReadonlySet<string>; at: number }
  private loading?: Promise<ReadonlySet<string>>
  private cacheGeneration = 0

  constructor(modules: readonly (ModuleMetadata & { readonly prefix?: string })[], private readonly state?: ModuleStateStore) {
    this.ids = new Set(modules.filter(module => module.prefix !== '').map(module => module.id))
  }

  listModuleIds(): ReadonlySet<string> { return new Set(this.ids) }
  listMounted(): ReadonlySet<string> { return new Set(this.mounted) }
  isMounted(id: string): boolean { return this.mounted.has(id) }
  markMounted(id: string): void { this.mounted.add(id) }

  async enabledIdsCached(): Promise<ReadonlySet<string>> {
    if (!this.state) return new Set(this.ids)
    if (this.enabledMemo && Date.now() - this.enabledMemo.at < 1000) return new Set(this.enabledMemo.ids)
    if (!this.loading) {
      const generation = this.cacheGeneration
      const pending = this.state.enabledIds().then(ids => {
        const snapshot = new Set(ids)
        if (generation === this.cacheGeneration) this.enabledMemo = { ids: snapshot, at: Date.now() }
        return snapshot
      })
      this.loading = pending
      void pending.finally(() => {
        if (this.loading === pending) this.loading = undefined
      }).catch(() => {})
    }
    return new Set(await this.loading)
  }

  async invalidateEnabledCache(): Promise<void> {
    this.cacheGeneration++
    this.enabledMemo = undefined
    this.loading = undefined
    await this.state?.invalidate?.()
  }
}
