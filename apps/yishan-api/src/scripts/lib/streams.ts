/**
 * streams.ts — 由仓库布局构造迁移流（运行在 dist/ 中的编译产物）。
 *
 *   - Core：`<apiRoot>/drizzle`，历史表 `__drizzle_migrations`，表结构取自 src/db/schema/tables；
 *   - 模块：`src/modules/<id>/drizzle`（源码缺失时退回 dist），历史表 `<id>_drizzle_migrations`，
 *     表结构取自编译后的 `modules/<id>/db/schema.js`。
 *
 * 只处理已打包（meta.enabled !== false）的模块，与启动挂载使用同一扫描函数。
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { scanDiskModulesPure, type ModuleDiskMeta } from '../../core/module-loader/module-loader.js'
import { CORE_MIGRATIONS_TABLE, moduleMigrationsTable } from '../../db/migrations-table.js'
import { tablesFromSchema, type MigrationStream } from './migration-streams.js'

export interface AppRoots {
  /** apps/yishan-api */
  apiRoot: string
  srcRoot: string
  distRoot: string
}

/** 以编译产物所在目录（dist/scripts/...）推导三个根目录。 */
export function rootsFromDist(distRoot: string): AppRoots {
  const apiRoot = join(distRoot, '..')
  return { apiRoot, srcRoot: join(apiRoot, 'src'), distRoot }
}

export function coreStream(roots: AppRoots): MigrationStream {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tables = require(join(roots.distRoot, 'db', 'schema', 'tables.js')) as Record<string, unknown>
  return {
    label: 'core',
    folder: join(roots.apiRoot, 'drizzle'),
    table: CORE_MIGRATIONS_TABLE,
    expectedTables: tablesFromSchema(tables),
  }
}

export function moduleStream(roots: AppRoots, meta: Pick<ModuleDiskMeta, 'id'>): MigrationStream | null {
  const srcFolder = join(roots.srcRoot, 'modules', meta.id, 'drizzle')
  const distFolder = join(roots.distRoot, 'modules', meta.id, 'drizzle')
  const folder = existsSync(srcFolder) ? srcFolder : existsSync(distFolder) ? distFolder : null
  if (!folder) return null
  const schemaJs = join(roots.distRoot, 'modules', meta.id, 'db', 'schema.js')
  if (!existsSync(schemaJs)) {
    throw new Error(`module ${meta.id}: ${schemaJs} missing; run build:ts before migrating`)
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const schema = require(schemaJs) as Record<string, unknown>
  return {
    label: `module ${meta.id}`,
    folder,
    table: moduleMigrationsTable(meta.id),
    expectedTables: tablesFromSchema(schema),
  }
}

export async function packedModules(roots: AppRoots, only?: string[]): Promise<ModuleDiskMeta[]> {
  const all = await scanDiskModulesPure(roots.srcRoot, roots.distRoot)
  if (!only || only.length === 0) return all
  const unknown = only.filter((id) => !all.some((m) => m.id === id))
  if (unknown.length > 0) throw new Error(`unknown or unpacked module(s): ${unknown.join(', ')}`)
  return all.filter((m) => only.includes(m.id))
}
