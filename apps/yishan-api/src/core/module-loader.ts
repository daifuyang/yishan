/**
 * module-loader.ts — 单一职责：管理业务模块的装载与卸载。
 *
 * 模块启停的事实源是 MySQL `sys_module.enabled`。本文件封装三件事：
 *   1. `syncModulesFromDisk`：扫 src/modules/<id>/routes.ts，INSERT 缺失行（默认 enabled = 1）、
 *      UPDATE 结构字段（name / table_prefix / version）。永远不动 `enabled` 列。
 *   2. `loadEnabledModuleIds`：从 DB 读取 enabled = 1 的 id 集合，带 Redis 缓存。
 *   3. `mountAllOnDisk`：boot 期用标准 @fastify/autoload 挂载所有【已打包在盘上】的模块，
 *      prefix 硬约定 /api/<id>。运行时启停不改挂载，由 app.ts 的 onRequest gate 按
 *      sys_module.enabled 拦截实现（即时、零重启）。
 *
 * 不变量：
 *   - 路由 prefix 硬约定为 `/api/${id}`，不再由模块 meta 声明，也不做 prefix 唯一性校验
 *     （id 唯一性由文件系统保证）。
 *   - fastify 插件树 boot 后不可变：不做运行时 register/unregister；启停走 gate 拦截。
 *   - syncModulesFromDisk 不允许覆盖 enabled；运维显式停用的模块，重启后必须保持停用。
 */
import { eq, inArray } from 'drizzle-orm'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { drizzleDb, type AppDb } from '@/db'
import { sysModule } from '@/db/schema/tables'

const REDIS_ENABLED_KEY = 'yishan:modules:enabled'
const REDIS_CACHE_TTL_SECONDS = 60

/** 模块路由 prefix 硬约定；不再由模块 meta 声明。 */
export function moduleRoutePrefix(id: string): string {
  return `/api/${id}`
}

export interface ModuleDiskMeta {
  id: string
  name: string
  enabled: boolean
  tablePrefix: string
  version: string
  /** 模块目录绝对路径，便于 re-import。 */
  moduleDir: string
}

export interface ModuleRow {
  id: string
  name: string
  tablePrefix: string
  version: string
  enabled: boolean
  installedAt: Date
  updatedAt: Date
}

export class ModuleLoader {
  private readonly fastify: FastifyInstance
  /** 源码根（绝对路径），用于读 meta / migrations journal 等运行时元数据。 */
  private readonly srcRoot: string
  /** 编译产物根（绝对路径），用于 `import('routes.js')`。 */
  private readonly distRoot: string
  private mounted = new Set<string>()
  private dbCache: AppDb | undefined
  /** enabled 集合的进程内短 TTL 缓存，避免 gate 每请求打 redis/DB。 */
  private enabledMemo: { ids: Set<string>; at: number } | undefined
  private readonly ENABLED_MEMO_MS = 5000

  constructor(fastify: FastifyInstance, srcRoot: string, distRoot: string) {
    this.fastify = fastify
    this.srcRoot = srcRoot
    this.distRoot = distRoot
  }

  private get db(): AppDb {
    if (!this.dbCache) this.dbCache = drizzleDb
    return this.dbCache
  }

  // -------------------------------------------------------------------------
  // 磁盘扫描
  // -------------------------------------------------------------------------

  /**
   * 扫 src/modules/<id>/ 收集 disk meta。
   * 自动推断 routes 入口：优先 dist/<id>/routes.js（编译产物），回退 src/<id>/routes.ts（dev/tsx 模式）。
   * 同时携带 `defaultEnabled`（AGENTS.md §3 字段）与 `name`，供 sync 时使用。
   */
  async scanDiskModules(): Promise<ModuleDiskMeta[]> {
    const srcModulesDir = join(this.srcRoot, 'modules')
    if (!existsSync(srcModulesDir)) return []
    const out: ModuleDiskMeta[] = []
    for (const id of readdirSync(srcModulesDir)) {
      const srcModuleDir = join(srcModulesDir, id)
      if (!statSync(srcModuleDir).isDirectory()) continue
      const distRoutesJs = join(this.distRoot, 'modules', id, 'routes.js')
      const srcRoutesTs = join(srcModuleDir, 'routes.ts')
      let routesEntry: string | undefined
      let isTs: boolean
      if (existsSync(distRoutesJs)) {
        routesEntry = distRoutesJs
        isTs = false
      } else if (existsSync(srcRoutesTs)) {
        routesEntry = srcRoutesTs
        isTs = true
      } else {
        this.fastify.log.warn({ module: id }, 'module skipped: routes.{js,ts} missing')
        continue
      }
      const mod: {
        meta?: Partial<ModuleDiskMeta & { name?: string; enabled?: boolean }>
      } = isTs
        ? await import(routesEntry).catch(() => ({} as { meta?: unknown }))
        : await import(routesEntry)
      const meta = mod.meta
      if (!meta?.id || typeof meta.id !== 'string') {
        this.fastify.log.warn({ module: id }, 'module skipped: meta.id missing')
        continue
      }
      out.push({
        id: meta.id,
        name: typeof meta.name === 'string' && meta.name.length > 0 ? meta.name : meta.id,
        enabled: meta.enabled === undefined ? true : Boolean(meta.enabled),
        tablePrefix: typeof meta.tablePrefix === 'string' && meta.tablePrefix.length > 0
          ? meta.tablePrefix
          : `${meta.id}_`,
        version: typeof meta.version === 'string' && meta.version.length > 0
          ? meta.version
          : '0.0.0',
        moduleDir: srcModuleDir,
      })
    }
    out.sort((a, b) => a.id.localeCompare(b.id))
    return out
  }

  // -------------------------------------------------------------------------
  // DB 同步：INSERT 缺失 + UPDATE 结构字段，绝不动 enabled
  // -------------------------------------------------------------------------

  /**
   * 把磁盘扫描结果同步进 sys_module。
   *   - 行不存在 → INSERT（默认 enabled = 1）。
   *   - 行已存在 → UPDATE name/prefix/table_prefix/version；enabled 不变。
   *   - 磁盘不存在但 DB 里存在 → 不处理（保留历史记录，留给运维手动卸载）。
   */
  async syncModulesFromDisk(diskModules: ModuleDiskMeta[]): Promise<void> {
    const ids = diskModules.map((m) => m.id)
    const existing = ids.length === 0
      ? []
      : await this.db.select({ id: sysModule.id }).from(sysModule).where(inArray(sysModule.id, ids))
    const existingSet = new Set(existing.map((r) => r.id))

    for (const m of diskModules) {
      if (existingSet.has(m.id)) {
        await this.db
          .update(sysModule)
          .set({
            name: m.name,
            tablePrefix: m.tablePrefix,
            version: m.version,
            updatedAt: new Date(),
          })
          .where(eq(sysModule.id, m.id))
      } else {
        await this.db.insert(sysModule).values({
          id: m.id,
          name: m.name,
          tablePrefix: m.tablePrefix,
          version: m.version,
          enabled: m.enabled ? 1 : 0,
        })
      }
    }
  }

  // -------------------------------------------------------------------------
  // 启停事实查询
  // -------------------------------------------------------------------------

  async loadEnabledIdsFromDb(): Promise<Set<string>> {
    const rows = await this.db
      .select({ id: sysModule.id })
      .from(sysModule)
      .where(eq(sysModule.enabled, 1))
    return new Set(rows.map((r) => r.id))
  }

  /**
   * Redis 优先：命中即用，未命中查 DB 并回填。Redis 不可用时降级直接查 DB。
   * toggle 调用方负责 DEL 这个 key。
   */
  async loadEnabledIds(): Promise<Set<string>> {
    const redis = (this.fastify as unknown as { redis?: { get: (k: string) => Promise<string | null>; set: (k: string, v: string, ...rest: unknown[]) => Promise<unknown> } }).redis
    if (redis) {
      try {
        const cached = await redis.get(REDIS_ENABLED_KEY)
        if (cached) {
          const arr = JSON.parse(cached) as string[]
          return new Set(arr)
        }
        const ids = await this.loadEnabledIdsFromDb()
        await redis.set(
          REDIS_ENABLED_KEY,
          JSON.stringify([...ids]),
          'EX',
          REDIS_CACHE_TTL_SECONDS,
        )
        return ids
      } catch (err) {
        this.fastify.log.warn({ err }, 'redis read failed, fallback to db')
      }
    }
    return this.loadEnabledIdsFromDb()
  }

  async invalidateEnabledCache(): Promise<void> {
    this.enabledMemo = undefined
    const redis = (this.fastify as unknown as { redis?: { del: (k: string) => Promise<unknown> } }).redis
    if (!redis) return
    try {
      await redis.del(REDIS_ENABLED_KEY)
    } catch (err) {
      this.fastify.log.warn({ err }, 'redis del failed')
    }
  }

  /**
   * gate 专用：带进程内短 TTL 的 enabled 集合。toggle 时会经 invalidateEnabledCache 立即清空，
   * 因此启停对下一个请求即时生效，同时避免每请求都打 redis/DB。
   */
  async enabledIdsCached(): Promise<Set<string>> {
    const now = Date.now()
    if (this.enabledMemo && now - this.enabledMemo.at < this.ENABLED_MEMO_MS) {
      return this.enabledMemo.ids
    }
    const ids = await this.loadEnabledIds()
    this.enabledMemo = { ids, at: now }
    return ids
  }

  // -------------------------------------------------------------------------
  // boot 期挂载（标准 autoload，一次性）
  //
  // fastify 插件树 boot 后不可变，运行时无法 register/unregister 路由，因此不再做
  // 「热挂载/热卸载」。boot 时无条件挂载所有【已打包在盘上】的模块；运行时启停由
  // app.ts 的 onRequest gate 按 sys_module.enabled 拦截实现（即时、零重启）。
  // -------------------------------------------------------------------------

  isMounted(id: string): boolean {
    return this.mounted.has(id)
  }

  /** 所有已挂载（= 已打包在 dist/盘上）的模块 id。gate 用它识别哪些前缀属于模块。 */
  listModuleIds(): Set<string> {
    return new Set(this.mounted)
  }

  listMounted(): string[] {
    return [...this.mounted].sort()
  }

  /**
   * 用标准 @fastify/autoload 挂载单个模块的 routes/ 目录，prefix 硬约定 /api/<id>。
   * routesDir 优先 dist/<id>/routes（已编译），fallback src/<id>/routes（tsx 模式）。
   */
  private async mountModuleRoutes(meta: ModuleDiskMeta): Promise<void> {
    if (this.mounted.has(meta.id)) return
    const distRoutesDir = join(this.distRoot, 'modules', meta.id, 'routes')
    const srcRoutesDir = join(meta.moduleDir, 'routes')
    let routesDir: string
    if (existsSync(distRoutesDir)) {
      routesDir = distRoutesDir
    } else if (existsSync(srcRoutesDir)) {
      routesDir = srcRoutesDir
    } else {
      this.fastify.log.warn({ module: meta.id }, 'module skipped: routes/ directory missing')
      return
    }
    const prefix = moduleRoutePrefix(meta.id)
    await this.fastify.register(AutoLoad, {
      dir: routesDir,
      autoHooks: true,
      cascadeHooks: true,
      options: { prefix },
    })
    this.mounted.add(meta.id)
    this.fastify.log.info({ module: meta.id, prefix }, 'module mounted')
  }

  /**
   * boot 时挂载所有磁盘模块（不看 enabled）。运行时启停交给 gate。
   */
  async mountAllOnDisk(diskModules: ModuleDiskMeta[]): Promise<void> {
    for (const meta of diskModules) {
      await this.mountModuleRoutes(meta)
    }
  }
}

// 让 fastify type 顺手通过：
void (null as unknown as FastifyPluginAsync)
