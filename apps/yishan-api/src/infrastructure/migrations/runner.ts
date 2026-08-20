/**
 * infrastructure/migrations/runner.ts
 *
 * 内部 FC 事件处理器，yishan-fc-migrate GitHub Actions 工作流专用。
 *
 * 入口：被 src/infrastructure/migrations/server.ts 通过 HTTP /invoke 转发；
 *       没有 HTTP trigger，对外不可访问。
 *
 * 与本地 db:migrate 的差别：
 *   - 跑在云上，没有交互终端，所以失败信息以 JSON 返回；
 *   - 需要 DRIZZLE_KIT_BIN 环境变量指向 drizzle-kit 可执行文件（prepare-migration-runner.sh
 *     会把 node_modules/.bin/drizzle-kit 平铺到 runner 函数包根）；
 *   - reset-and-seed 模式被显式禁用：生产 DROP DATABASE 需要走人工审核 + 备份流程，
 *     不应被一条 workflow_dispatch 触发。
 *
 * 模式：
 *   - dry-run：仅打印当前迁移状态，不写 DB
 *   - apply：应用 pending migration 后返回结果
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

import 'dotenv/config'
import { drizzleDb, pool } from '@/db'
import { sysModuleMigration } from '@/db/schema'
import { inArray } from 'drizzle-orm'

const APP_ROOT = join(__dirname, '..', '..', '..')
const DRIZZLE_DIR = join(APP_ROOT, 'drizzle')
// prepare-migration-runner.sh 会把 node_modules/.bin/drizzle-kit 平铺到函数包根，
// 这样 runner 在 FC 上无需走 node_modules 解析也能直接执行。
const DRIZZLE_KIT_BIN = process.env.DRIZZLE_KIT_BIN || join(APP_ROOT, 'drizzle-kit')

/**
 * drizzle/meta/_journal.json 由 `pnpm db:generate` 写入，已 checked-in（与每个模块
 * 的 drizzle/meta 保持一致的处理方式）。core 层的初始迁移 tag 固定为 `0000_init`，
 * 通过 package.json `db:generate` 脚本里的 `--name=init` 保证跨环境稳定——否则
 * drizzle-kit 会生成 `0000_<random>` 这种不可预测的 tag，导致 core 的 `__drizzle_migrations`
 * 行 hash 与新 journal 对不上，runner 的 inspect 永远把它们标成 pending。
 */

export type MigrationMode = 'dry-run' | 'apply'

export interface MigrationRunnerEvent {
  mode?: MigrationMode
}

export interface MigrationPlanRow {
  tag: string
  applied: boolean
}

export interface MigrationRunnerResult {
  mode: MigrationMode
  status: 'ok' | 'failed'
  startedAt: string
  finishedAt: string
  plan: MigrationPlanRow[]
  /** 仅 apply 模式有值：从 drizzle-kit migrate stdout 截取的摘要 */
  applied?: string[]
  error?: string
}

interface DrizzleJournal {
  entries: { tag: string }[]
}

function loadJournal(): { tag: string }[] {
  const journalPath = join(DRIZZLE_DIR, 'meta', '_journal.json')
  if (!existsSync(journalPath)) {
    throw new Error(`找不到 drizzle journal: ${journalPath}（runner 函数包未正确构建）`)
  }
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as DrizzleJournal
  return journal.entries
}

async function loadAppliedHashes(): Promise<Set<string>> {
  const rows = await drizzleDb
    .select({ hash: sysModuleMigration.hash })
    .from(sysModuleMigration)
  return new Set(rows.map((r) => r.hash))
}

/**
 * 检查当前所有模块 SQL 文件是否都已 apply。core drizzle/ 用 __drizzle_migrations 表
 * 跟踪；模块自己用 sys_module_migration 跟踪。这里把两层都看一遍，dry-run 时给出
 * 全量 diff。
 */
async function inspect(): Promise<{ core: MigrationPlanRow[]; modules: MigrationPlanRow[] }> {
  // core 层：直接 SELECT drizzle 历史表
  const [coreRows] = await pool.query<any[]>(
    'SELECT hash, name FROM __drizzle_migrations ORDER BY id',
  )
  const coreApplied = new Set<string>((coreRows as Array<{ hash: string }>).map((r) => r.hash))
  const coreJournal = loadJournal()
  const corePlan: MigrationPlanRow[] = coreJournal.map((e) => ({
    tag: e.tag,
    applied: coreApplied.has(e.tag),
  }))

  // module 层：扫 src/modules/*/drizzle/meta/_journal.json
  const modulesDir = join(APP_ROOT, 'src', 'modules')
  const moduleIds: string[] = []
  if (existsSync(modulesDir)) {
    for (const id of readdirSync(modulesDir)) {
      const p = join(modulesDir, id)
      if (statSync(p).isDirectory()) moduleIds.push(id)
    }
  }
  const moduleApplied = await loadAppliedHashes()
  const modulePlan: MigrationPlanRow[] = []
  for (const id of moduleIds.sort()) {
    const journalPath = join(modulesDir, id, 'drizzle', 'meta', '_journal.json')
    if (!existsSync(journalPath)) continue
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as DrizzleJournal
    for (const e of journal.entries) {
      modulePlan.push({ tag: `${id}/${e.tag}`, applied: moduleApplied.has(e.tag) })
    }
  }

  return { core: corePlan, modules: modulePlan }
}

function runDrizzleMigrateCore(): { stdout: string; stderr: string } {
  if (!existsSync(DRIZZLE_KIT_BIN)) {
    throw new Error(
      `drizzle-kit 未找到: ${DRIZZLE_KIT_BIN}。请检查 prepare-migration-runner.sh 是否把 node_modules/.bin 平铺到 runner 包根目录。`,
    )
  }
  try {
    const stdout = execFileSync(DRIZZLE_KIT_BIN, ['migrate'], {
      cwd: APP_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { stdout, stderr: '' }
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string }
    return {
      stdout: typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf8') ?? '',
      stderr: typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8') ?? err.message ?? '',
    }
  }
}

/**
 * 对每个模块单独跑 drizzle-kit migrate（按模块自己的 drizzle.config），然后把
 * journal 里的 tag 同步进 sys_module_migration 表。这样 runMigrations 完成了和
 * onboard-modules 一样的逻辑，但只跑迁移步骤，不跑 seed。
 */
async function runModuleMigrations(): Promise<string[]> {
  const modulesDir = join(APP_ROOT, 'src', 'modules')
  if (!existsSync(modulesDir)) return []
  const applied: string[] = []
  for (const id of readdirSync(modulesDir).sort()) {
    const moduleSrcDir = join(modulesDir, id)
    if (!statSync(moduleSrcDir).isDirectory()) continue
    const configTs = join(moduleSrcDir, 'drizzle.config.ts')
    const configJs = join(moduleSrcDir, 'drizzle.config.js')
    if (!existsSync(configTs) && !existsSync(configJs)) continue

    const cwd = existsSync(configTs) ? moduleSrcDir : join(APP_ROOT, 'dist', 'modules', id)
    const configFlag = existsSync(configTs)
      ? '--config=./drizzle.config.ts'
      : '--config=./drizzle.config.js'

    try {
      execFileSync(DRIZZLE_KIT_BIN, [configFlag, 'migrate'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e: unknown) {
      const err = e as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string }
      const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8') ?? ''
      const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf8') ?? ''
      throw new Error(`模块 ${id} 迁移失败:\n${stderr || stdout || err.message}`)
    }

    // 同步 journal hash 到 sys_module_migration
    const journalPath = join(moduleSrcDir, 'drizzle', 'meta', '_journal.json')
    if (!existsSync(journalPath)) continue
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as DrizzleJournal
    const tags = journal.entries.map((e) => e.tag)
    const existing = await drizzleDb
      .select({ hash: sysModuleMigration.hash })
      .from(sysModuleMigration)
      .where(inArray(sysModuleMigration.hash, tags))
    const existingSet = new Set(existing.map((r) => r.hash))
    const newTags = tags.filter((t) => !existingSet.has(t))
    if (newTags.length > 0) {
      await drizzleDb
        .insert(sysModuleMigration)
        .values(newTags.map((tag) => ({ moduleId: id, hash: tag })))
      applied.push(`${id}: +${newTags.length}`)
    } else {
      applied.push(`${id}: noop`)
    }
  }
  return applied
}

export async function handler(event: MigrationRunnerEvent = {}): Promise<MigrationRunnerResult> {
  // 防御性兜底：即便 TS 已收紧类型，未来若扩展 MigrationMode 误加入 'reset-and-seed'
  // 也走不通。生产 DROP DATABASE 必须人工审核，不应被任意 workflow 触发。
  if ((event.mode as string) === 'reset-and-seed') {
    throw new Error(
      'reset-and-seed 模式不在 FC runner 中暴露：生产环境 DROP DATABASE 必须人工审核 + 备份，' +
        '请通过本地 db:reset 脚本执行（已带 NODE_ENV=production 防护）。',
    )
  }

  const mode: MigrationMode = event.mode ?? 'dry-run'
  const startedAt = new Date()

  const plan = await inspect()

  if (mode === 'dry-run') {
    return {
      mode,
      status: 'ok',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      plan: [...plan.core, ...plan.modules],
    }
  }

  // apply：先 core 后 module
  const applied: string[] = []
  try {
    const coreResult = runDrizzleMigrateCore()
    if (coreResult.stderr.trim()) {
      throw new Error(`core drizzle-kit migrate 失败: ${coreResult.stderr}`)
    }
    applied.push(`core: ok`)
    const moduleResults = await runModuleMigrations()
    applied.push(...moduleResults)
  } catch (e: unknown) {
    const err = e as Error
    return {
      mode,
      status: 'failed',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      plan: [...plan.core, ...plan.modules],
      applied,
      error: err.message,
    }
  }

  // 重新拉一次 plan 给最终状态
  const finalPlan = await inspect()
  return {
    mode,
    status: 'ok',
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    plan: [...finalPlan.core, ...finalPlan.modules],
    applied,
  }
}
