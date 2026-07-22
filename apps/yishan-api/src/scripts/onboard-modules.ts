/**
 * onboard-modules.ts — 模块入驻编排脚本。
 *
 * 对 src/modules/<id>/ 下的每个模块依次执行三步：
 *   1. 迁移：调用 drizzle-kit migrate（应用模块 drizzle/ 下的 SQL 到 DB）。
 *      迁移完成后把 _journal.json 中的所有 tag 同步进 sys_module_migration。
 *   2. seed：执行模块自带的 seed 入口（seed.ts / scripts/seed.ts / db/seed.ts）。
 *      业务数据、菜单声明、权限码注册都在这里完成。
 *   3. 占位：早期版本在这里处理 sys_menu 写入，模块自描述后改为由 seed.ts 负责。
 *
 * 入口：被 `pnpm db:seed` 的 Step 2/2 通过 spawnOnboard() 调用；
 *      不再有独立的 `db:seed:modules` 脚本——core seed 与模块入驻是一体编排。
 *
 * 设计约束：
 *   - 单步失败不阻断后续模块。
 *   - 只写 DB；不写源码。
 *   - 菜单追加由模块 seed.ts 自管理。
 */

import 'dotenv/config'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { inArray } from 'drizzle-orm'
import { drizzleDb, pool } from '@/db'
import { sysModuleMigration } from '@/db/schema'

const APP_ROOT_DIST = join(__dirname, '..')
const APP_ROOT_SRC = join(APP_ROOT_DIST, '..', 'src')
const MODULES_SRC = join(APP_ROOT_SRC, 'modules')
const MODULES_DIST = join(APP_ROOT_DIST, 'modules')
const DRIZZLE_KIT = join(APP_ROOT_DIST, '..', 'node_modules', '.bin', 'drizzle-kit')

interface StepOutcome {
  ok: boolean
  message: string
}

interface ModuleResult {
  id: string
  migrate: StepOutcome
  seed: StepOutcome
  menuAppend: StepOutcome
}

async function listModules(): Promise<string[]> {
  if (!existsSync(MODULES_SRC)) return []
  const ids: string[] = []
  for (const id of readdirSync(MODULES_SRC)) {
    const dir = join(MODULES_SRC, id)
    if (!statSync(dir).isDirectory()) continue
    const moduleEntry = join(dir, 'module.ts')
    if (existsSync(moduleEntry) || existsSync(join(MODULES_DIST, id, 'module.js'))) {
      ids.push(id)
    }
  }
  return ids.sort()
}

async function runDrizzleKit(
  cwd: string,
  configFlag: string,
  args: string[],
): Promise<StepOutcome> {
  return new Promise((resolve) => {
    const child = spawn(DRIZZLE_KIT, [configFlag, ...args], { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', (err) => {
      resolve({ ok: false, message: `drizzle-kit 启动失败: ${err.message}` })
    })
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        message: code === 0 ? '迁移完成' : `drizzle-kit exit ${code}\n${stderr || stdout}`.trim(),
      })
    })
  })
}

async function syncModuleMigrationJournal(id: string): Promise<{ applied: number }> {
  const journalPath = join(MODULES_SRC, id, 'drizzle', 'meta', '_journal.json')
  if (!existsSync(journalPath)) return { applied: 0 }
  type Journal = { entries: { tag: string }[] }
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal
  const tags = journal.entries.map((e) => e.tag)
  if (tags.length === 0) return { applied: 0 }
  const existing = await drizzleDb
    .select({ hash: sysModuleMigration.hash })
    .from(sysModuleMigration)
    .where(inArray(sysModuleMigration.hash, tags))
  const existingSet = new Set(existing.map((r) => r.hash))
  const newTags = tags.filter((t) => !existingSet.has(t))
  if (newTags.length === 0) return { applied: 0 }
  await drizzleDb.insert(sysModuleMigration).values(
    newTags.map((tag) => ({ moduleId: id, hash: tag })),
  )
  return { applied: newTags.length }
}

async function migrateModule(id: string): Promise<StepOutcome> {
  const moduleSrcDir = join(MODULES_SRC, id)
  const moduleDistDir = join(MODULES_DIST, id)
  const configTs = join(moduleSrcDir, 'drizzle.config.ts')
  const configJs = join(moduleDistDir, 'drizzle.config.js')
  if (!existsSync(configTs) && !existsSync(configJs)) {
    return { ok: true, message: '无 drizzle.config，跳过迁移' }
  }
  const cwd = existsSync(configTs) ? moduleSrcDir : moduleDistDir
  const configFlag = existsSync(configTs)
    ? '--config=./drizzle.config.ts'
    : '--config=./drizzle.config.js'

  const runResult = await runDrizzleKit(cwd, configFlag, ['migrate'])
  if (!runResult.ok) return runResult
  try {
    const { applied } = await syncModuleMigrationJournal(id)
    return {
      ok: true,
      message: applied > 0 ? `迁移完成，新增 ${applied} 条 journal 记录` : '迁移完成（journal 已全部记录）',
    }
  } catch (err) {
    return { ok: false, message: `迁移成功但同步 sys_module_migration 失败: ${(err as Error).message}` }
  }
}

function resolveSeedEntry(id: string): { src: string; dist: string } | null {
  const moduleSrcDir = join(MODULES_SRC, id)
  const moduleDistDir = join(MODULES_DIST, id)
  const candidates = [
    join(moduleSrcDir, 'seed.ts'),
    join(moduleSrcDir, 'scripts', 'seed.ts'),
    join(moduleSrcDir, 'db', 'seed.ts'),
  ]
  const sourceEntry = candidates.find((p) => existsSync(p))
  if (!sourceEntry) return null
  const rel = sourceEntry.slice(moduleSrcDir.length + 1)
  const distEntry = join(moduleDistDir, rel.replace(/\.ts$/, '.js'))
  return { src: sourceEntry, dist: distEntry }
}

async function seedModule(id: string): Promise<StepOutcome> {
  const entry = resolveSeedEntry(id)
  if (!entry) return { ok: true, message: '无 seed 入口，跳过' }
  if (!existsSync(entry.dist)) {
    return { ok: false, message: `seed 已写源码（${entry.src}）但未编译：${entry.dist}（先 npm run build:ts）` }
  }
  return new Promise((resolve) => {
    const cwd = join(MODULES_DIST, id)
    const child = spawn(process.execPath, [entry.dist], { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', (err) => {
      resolve({ ok: false, message: `seed 启动失败: ${err.message}` })
    })
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        message: code === 0 ? 'seed 完成' : `seed exit ${code}\n${stderr || stdout}`.trim(),
      })
    })
  })
}

async function appendModuleMenu(id: string): Promise<StepOutcome> {
  // 菜单由模块自带的 seed.ts 负责写入（"插件自描述"形式）。
  void id
  return { ok: true, message: '菜单由模块 seed.ts 负责' }
}

async function onboardOne(id: string): Promise<ModuleResult> {
  console.log(`\n=== 模块 ${id} ===`)
  const migrate = await migrateModule(id)
  console.log(`  [1/3 migrate] ${migrate.ok ? 'OK' : 'FAIL'}  ${migrate.message}`)
  if (!migrate.ok) {
    return {
      id,
      migrate,
      seed: { ok: true, message: '迁移失败，跳过 seed' },
      menuAppend: { ok: true, message: '迁移失败，跳过菜单追加' },
    }
  }
  const seed = await seedModule(id)
  console.log(`  [2/3 seed]    ${seed.ok ? 'OK' : 'FAIL'}  ${seed.message}`)
  const menuAppend = await appendModuleMenu(id)
  console.log(`  [3/3 menu]    ${menuAppend.ok ? 'OK' : 'FAIL'}  ${menuAppend.message}`)
  return { id, migrate, seed, menuAppend }
}

async function main() {
  const ids = await listModules()
  if (ids.length === 0) {
    console.log('未发现任何模块（src/modules/ 为空）。')
    return
  }
  console.log(`发现 ${ids.length} 个模块：${ids.join(', ')}`)
  console.log('开始按模块执行 migrate → seed → 菜单追加 ...')

  const results: ModuleResult[] = []
  for (const id of ids) {
    results.push(await onboardOne(id))
  }

  const failed = results.filter((r) => !r.migrate.ok || !r.seed.ok || !r.menuAppend.ok)
  console.log('\n=== 汇总 ===')
  for (const r of results) {
    const tag = failed.includes(r) ? 'FAIL' : 'OK'
    console.log(`  [${tag}] ${r.id}: migrate=${r.migrate.ok ? 'ok' : 'fail'}  seed=${r.seed.ok ? 'ok' : 'fail'}  menu=${r.menuAppend.ok ? 'ok' : 'fail'}`)
  }
  if (failed.length > 0) {
    process.exitCode = 1
  }
  await pool.end()
}

main().catch((err) => {
  console.error('onboard-modules 异常退出:', err)
  process.exit(1)
})
