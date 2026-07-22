/**
 * module-loader.ts — 单一职责：管理业务模块的装载与卸载。
 *
 * 模块启停的事实源是 MySQL `sys_module.enabled`。本文件封装三件事：
 *   1. `syncModulesFromDisk`：扫 src/modules/<id>/,INSERT 缺失行(默认 enabled = 1)、
 *      UPDATE 结构字段(name / table_prefix / version)。永远不动 `enabled` 列。
 *   2. `loadEnabledModuleIds`：从 DB 读取 enabled = 1 的 id 集合,带 Redis 缓存。
 *   3. `mountAllOnDisk`：boot 期用标准 @fastify/autoload 挂载所有【已打包在盘上】的模块,
 *      prefix 硬约定 /api/<id>。运行时启停不改挂载,由 app.ts 的 onRequest gate 按
 *      sys_module.enabled 拦截实现(即时、零重启)。
 *
 * 不变量：
 *   - 路由 prefix 硬约定为 `/api/${id}`,不再由模块 meta 声明,也不做 prefix 唯一性校验
 *     (id 唯一性由文件系统保证)。
 *   - fastify 插件树 boot 后不可变：不做运行时 register/unregister;启停走 gate 拦截。
 *   - syncModulesFromDisk 不允许覆盖 enabled;运维显式停用的模块,重启后必须保持停用。
 *
 * 入口策略(由 NODE_ENV 决定):
 *   - dev (NODE_ENV !== 'production'):优先读 src/<id>/module.ts(开发热更友好)
 *   - prod:优先读 dist/<id>/module.js(线上必须用编译产物)
 */
import { eq, inArray } from 'drizzle-orm'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import type { FastifyInstance, FastifyPluginAsync, FastifyBaseLogger } from 'fastify'
import { drizzleDb, type AppDb } from '@/db'
import { sysModule } from '@/db/schema/tables'

const REDIS_ENABLED_KEY = 'yishan:modules:enabled'
const REDIS_CACHE_TTL_SECONDS = 60

/** dev/prod 公用：判断本进程是否应该优先读 src 而非 dist。 */
export function shouldPreferSrc(): boolean {
  return process.env.NODE_ENV !== 'production'
}

/** 模块路由 prefix 硬约定;不再由模块 meta 声明。 */
export function moduleRoutePrefix(id: string): string {
  return `/api/${id}`
}

/**
 * 纯函数版 scanDiskModules:扫描 src/modules/<id>/,根据 preferSrc 决定入口文件。
 *
 *   - preferSrc=true:优先 src/<id>/module.ts,回退 dist/<id>/module.js(适用于 dev / tsx 模式)
 *   - preferSrc=false:优先 dist/<id>/module.js,回退 src/<id>/module.ts(适用于 prod)
 *
 * 返回 ModuleDiskMeta[] 供 syncModulesFromDiskPure 等下游使用。
 */
export async function scanDiskModulesPure(
  srcRoot: string,
  distRoot: string,
  preferSrc: boolean,
  logger?: FastifyBaseLogger,
): Promise<ModuleDiskMeta[]> {
  const srcModulesDir = join(srcRoot, 'modules')
  if (!existsSync(srcModulesDir)) return []
  const out: ModuleDiskMeta[] = []
  for (const id of readdirSync(srcModulesDir)) {
    const srcModuleDir = join(srcModulesDir, id)
    if (!statSync(srcModuleDir).isDirectory()) continue
    const distModuleJs = join(distRoot, 'modules', id, 'module.js')
    const srcModuleTs = join(srcModuleDir, 'module.ts')
    let moduleEntry: string | undefined
    let isTs: boolean
    if (preferSrc && existsSync(srcModuleTs)) {
      moduleEntry = srcModuleTs
      isTs = true
    } else if (existsSync(distModuleJs)) {
      moduleEntry = distModuleJs
      isTs = false
    } else if (existsSync(srcModuleTs)) {
      moduleEntry = srcModuleTs
      isTs = true
    } else {
      logger?.warn({ module: id }, 'module skipped: module.{js,ts} missing')
      continue
    }
    const mod: {
      meta?: Partial<ModuleDiskMeta & { name?: string; enabled?: boolean }>
    } = isTs
      ? await import(moduleEntry).catch(() => ({} as { meta?: unknown }))
      : await import(moduleEntry)
    const meta = mod.meta
    if (!meta?.id || typeof meta.id !== 'string') {
      logger?.warn({ module: id }, 'module skipped: meta.id missing')
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

/**
 * 纯函数版 syncModulesFromDisk:不依赖 fastify/ModuleLoader 实例,
 * 任何能拿到 drizzle db 句柄的地方都能调用(onboard-modules.ts、reset 脚本等)。
 *
 * 行为：
 *   - 行不存在 → INSERT(默认 enabled = m.enabled ? 1 : 0)
 *   - 行已存在 → UPDATE name / tablePrefix / version / updated_at;enabled 列永不动
 *   - 磁盘不存在但 DB 里存在 → 不处理,留给运维手动卸载
 */
export async function syncModulesFromDiskPure(
  db: AppDb,
  diskModules: ModuleDiskMeta[],
): Promise<{ inserted: number; updated: number }> {
  const ids = diskModules.map((m) => m.id)
  const existing = ids.length === 0
    ? []
    : await db.select({ id: sysModule.id }).from(sysModule).where(inArray(sysModule.id, ids))
  const existingSet = new Set(existing.map((r) => r.id))

  let inserted = 0
  let updated = 0
  for (const m of diskModules) {
    if (existingSet.has(m.id)) {
      await db
        .update(sysModule)
        .set({
          name: m.name,
          tablePrefix: m.tablePrefix,
          version: m.version,
          updatedAt: new Date(),
        })
        .where(eq(sysModule.id, m.id))
      updated++
    } else {
      await db.insert(sysModule).values({
        id: m.id,
        name: m.name,
        tablePrefix: m.tablePrefix,
        version: m.version,
        enabled: m.enabled ? 1 : 0,
      })
      inserted++
    }
  }
  return { inserted, updated }
}

export interface ModuleDiskMeta {
  id: string
  name: string
  enabled: boolean
  tablePrefix: string
  version: string
  /** 模块目录绝对路径,便于 re-import。 */
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
  /** 源码根(绝对路径),用于读 meta / migrations journal 等运行时元数据。 */
  private readonly srcRoot: string
  /** 编译产物根(绝对路径),用于 `import('module.js')`。 */
  private readonly distRoot: string
  /**
   * 是否优先读 src/<id>/module.ts。
   * 默认由 NODE_ENV 决定(shouldPreferSrc);调用方也可显式覆盖(单测/特殊部署)。
   */
  private readonly preferSrc: boolean
  private mounted = new Set<string>()
  private dbCache: AppDb | undefined
  /** enabled 集合的进程内短 TTL 缓存,避免 gate 每请求打 redis/DB。 */
  private enabledMemo: { ids: Set<string>; at: number } | undefined
  private readonly ENABLED_MEMO_MS = 5000

  constructor(
    fastify: FastifyInstance,
    srcRoot: string,
    distRoot: string,
    options?: { preferSrc?: boolean },
  ) {
    this.fastify = fastify
    this.srcRoot = srcRoot
    this.distRoot = distRoot
    this.preferSrc = options?.preferSrc ?? shouldPreferSrc()
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
   * 入口策略由 `preferSrc` 决定：
   *   - preferSrc=true(dev)→ 优先 src/<id>/module.ts,回退 dist/<id>/module.js
   *   - preferSrc=false(prod)→ 优先 dist/<id>/module.js,回退 src/<id>/module.ts
   *
   * 同步到 sys_module 的兜底值与 meta.name 来自读到的入口。
   */
  async scanDiskModules(): Promise<ModuleDiskMeta[]> {
    return scanDiskModulesPure(this.srcRoot, this.distRoot, this.preferSrc, this.fastify.log)
  }

  // -------------------------------------------------------------------------
  // DB 同步：INSERT 缺失 + UPDATE 结构字段,绝不动 enabled
  // -------------------------------------------------------------------------

  /**
   * 把磁盘扫描结果同步进 sys_module。
   *   - 行不存在 → INSERT(默认 enabled = 1)。
   *   - 行已存在 → UPDATE name/prefix/table_prefix/version;enabled 不变。
   *   - 磁盘不存在但 DB 里存在 → 不处理(保留历史记录,留给运维手动卸载)。
   */
  async syncModulesFromDisk(diskModules: ModuleDiskMeta[]): Promise<void> {
    await syncModulesFromDiskPure(this.db, diskModules)
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
   * Redis 优先：命中即用,未命中查 DB 并回填。Redis 不可用时降级直接查 DB。
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
   * gate 专用：带进程内短 TTL 的 enabled 集合。toggle 时会经 invalidateEnabledCache 立即清空,
   * 因此启停对下一个请求即时生效,同时避免每请求都打 redis/DB。
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
  // boot 期挂载(标准 autoload,一次性)
  //
  // fastify 插件树 boot 后不可变,运行时无法 register/unregister 路由,因此不再做
  // 「热挂载/热卸载」。boot 时无条件挂载所有【已打包在盘上】的模块;运行时启停由
  // app.ts 的 onRequest gate 按 sys_module.enabled 拦截实现(即时、零重启)。
  // -------------------------------------------------------------------------

  isMounted(id: string): boolean {
    return this.mounted.has(id)
  }

  /** 所有已挂载(= 已打包在 dist/盘上)的模块 id。gate 用它识别哪些前缀属于模块。 */
  listModuleIds(): Set<string> {
    return new Set(this.mounted)
  }

  listMounted(): string[] {
    return [...this.mounted].sort()
  }

  /**
   * 用标准 @fastify/autoload 挂载单个模块的 routes/ 目录,prefix 硬约定 /api/<id>。
   * 入口策略与 scanDiskModulesPure 一致：preferSrc 时优先 src,否则优先 dist。
   */
  private async mountModuleRoutes(meta: ModuleDiskMeta): Promise<void> {
    if (this.mounted.has(meta.id)) return
    const distRoutesDir = join(this.distRoot, 'modules', meta.id, 'routes')
    const srcRoutesDir = join(meta.moduleDir, 'routes')
    let routesDir: string
    if (this.preferSrc && existsSync(srcRoutesDir)) {
      routesDir = srcRoutesDir
    } else if (existsSync(distRoutesDir)) {
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
   * boot 时挂载所有磁盘模块(不看 enabled)。运行时启停交给 gate。
   */
  async mountAllOnDisk(diskModules: ModuleDiskMeta[]): Promise<void> {
    for (const meta of diskModules) {
      await this.mountModuleRoutes(meta)
    }
  }
}

// 让 fastify type 顺手通过：
void (null as unknown as FastifyPluginAsync)