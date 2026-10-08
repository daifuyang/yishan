/**
 * onboard-modules.ts — 模块入驻编排脚本。
 *
 * 对已装载（meta.enabled !== false）的模块依次执行：
 *   1. 迁移：Drizzle 官方 migrator，模块独立历史表 `<id>_drizzle_migrations`；执行后核对
 *      journal 全部记录、schema 声明的表与列真实存在，再把 tag 按 (module_id, tag)
 *      同步进 sys_module_migration（见 lib/migration-streams.ts）。
 *   2. seed：执行模块自带的 seed 入口（seed.ts / scripts/seed.ts / db/seed.ts）的 default 导出。
 * 全部完成后同步 sys_module 行（与启动时同一纯函数）。
 *
 * 入口：被 `pnpm db:seed` 的 Step 2/2 通过 spawnOnboard() 调用。
 *
 * 设计约束：
 *   - 单个模块失败不阻断后续模块，但最终退出码为 1。
 *   - 迁移失败的模块不执行 seed。
 *   - 只写 DB；不写源码。
 */

import 'dotenv/config'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { drizzleDb, pool } from '@/db'
import { syncModulesFromDiskPure, type ModuleDiskMeta } from '../core/module-loader/module-loader.js'
import type { ModuleSeedContext } from '../core/module-loader/module-contract.js'
import { recordModuleMigrations, runMigrationStream } from './lib/migration-streams.js'
import { moduleStream, packedModules, rootsFromDist, type AppRoots } from './lib/streams.js'

interface StepOutcome {
  ok: boolean
  message: string
}

interface ModuleResult {
  id: string
  migrate: StepOutcome
  seed: StepOutcome
}

async function migrateModule(roots: AppRoots, meta: ModuleDiskMeta): Promise<StepOutcome> {
  try {
    const stream = moduleStream(roots, meta)
    if (!stream) return { ok: true, message: '无 drizzle/ 目录，跳过迁移' }
    const result = await runMigrationStream(pool, stream)
    const recorded = await recordModuleMigrations(pool, meta.id, result.recorded)
    const applied = result.applied.length > 0 ? `执行 ${result.applied.join(', ')}` : '无待执行迁移'
    return {
      ok: true,
      message: `${applied}；历史表 ${result.table}；校验表 ${result.verifiedTables.join(', ') || '（无）'}；sys_module_migration +${recorded}`,
    }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}

function resolveSeedEntry(roots: AppRoots, id: string): { src: string; dist: string } | null {
  const moduleSrcDir = join(roots.srcRoot, 'modules', id)
  const moduleDistDir = join(roots.distRoot, 'modules', id)
  const candidates = ['seed.ts', join('scripts', 'seed.ts'), join('db', 'seed.ts')]
  const rel = candidates.find((p) => existsSync(join(moduleSrcDir, p)) || existsSync(join(moduleDistDir, p.replace(/\.ts$/, '.js'))))
  if (!rel) return null
  return { src: join(moduleSrcDir, rel), dist: join(moduleDistDir, rel.replace(/\.ts$/, '.js')) }
}

async function seedModule(roots: AppRoots, id: string): Promise<StepOutcome> {
  const entry = resolveSeedEntry(roots, id)
  if (!entry) return { ok: true, message: '无 seed 入口，跳过' }
  if (!existsSync(entry.dist)) {
    return { ok: false, message: `seed 已写源码（${entry.src}）但未编译：${entry.dist}（先 pnpm build:ts）` }
  }
  // 同进程 require 编译产物（CommonJS）的 default 导出，复用同一个连接池。
  // 不用 import(pathToFileURL(...))：CommonJS 编译会把它降级为 require('file://...') 而失败（P0 R-02）。
  try {
    const mod = createRequire(__filename)(entry.dist) as { default?: (ctx: ModuleSeedContext) => Promise<void> }
    if (typeof mod.default !== 'function') {
      return { ok: false, message: `seed 入口 ${entry.dist} 未导出 default 函数` }
    }
    await mod.default({ db: drizzleDb })
    return { ok: true, message: 'seed 完成' }
  } catch (err) {
    return { ok: false, message: `seed 异常: ${(err as Error).message}` }
  }
}

async function onboardOne(roots: AppRoots, meta: ModuleDiskMeta): Promise<ModuleResult> {
  console.log(`\n=== 模块 ${meta.id} ===`)
  const migrate = await migrateModule(roots, meta)
  console.log(`  [1/2 migrate] ${migrate.ok ? 'OK' : 'FAIL'}  ${migrate.message}`)
  if (!migrate.ok) {
    return { id: meta.id, migrate, seed: { ok: false, message: '迁移失败，未执行 seed' } }
  }
  const seed = await seedModule(roots, meta.id)
  console.log(`  [2/2 seed]    ${seed.ok ? 'OK' : 'FAIL'}  ${seed.message}`)
  return { id: meta.id, migrate, seed }
}

async function main() {
  const roots = rootsFromDist(join(__dirname, '..'))
  const modules = await packedModules(roots)
  if (modules.length === 0) {
    console.log('未发现任何已装载模块（src/modules/ 为空或全部 meta.enabled=false）。')
    return
  }
  console.log(`发现 ${modules.length} 个模块：${modules.map((m) => m.id).join(', ')}`)

  const results: ModuleResult[] = []
  for (const meta of modules) {
    results.push(await onboardOne(roots, meta))
  }

  // seed 进程不经过 fastify，sys_module 行在这里用启动时同一个纯函数同步。
  console.log('\n[sync] 同步 sys_module 行（syncModulesFromDiskPure）...')
  try {
    const { inserted, updated } = await syncModulesFromDiskPure(drizzleDb, modules)
    console.log(`[sync] sys_module 完成：inserted=${inserted} updated=${updated}`)
  } catch (err) {
    console.error('[sync] 同步 sys_module 失败:', (err as Error).message)
    process.exitCode = 1
  }

  const failed = results.filter((r) => !r.migrate.ok || !r.seed.ok)
  console.log('\n=== 汇总 ===')
  for (const r of results) {
    const tag = failed.includes(r) ? 'FAIL' : 'OK'
    console.log(`  [${tag}] ${r.id}: migrate=${r.migrate.ok ? 'ok' : 'fail'}  seed=${r.seed.ok ? 'ok' : 'fail'}`)
  }
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error('onboard-modules 异常退出:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
