/**
 * onboard-modules.ts — 模块入驻编排脚本。
 *
 * 对 src/modules/<id>/ 下的每个模块依次执行三步：
 *   1. 迁移：调用 drizzle-kit migrate（应用模块 drizzle/ 下的 SQL 到 DB）。
 *      迁移完成后把 _journal.json 中的所有 tag 同步进 sys_module_migration，
 *      供控制台展示 applied/pending。
 *   2. seed：执行模块自带的 seed 入口（seed.ts / scripts/seed.ts / db/seed.ts），
 *      用于插入演示/基础数据。
 *   3. 菜单追加：若 module.json 里声明了 adminMenu，则 INSERT sys_menu 行
 *      （按 path 幂等，存在则跳过），并把对应权限码注册到 catalog、
 *      绑给 admin 角色与 super_admin 角色。
 *
 * 这是与 build/启停并列的「安装期」入口，由 npm run db:seed:modules 触发；
 * 已通过 drizzle-kit 应用过的 SQL 是幂等的，重复运行安全。
 *
 * 设计约束：
 *   - 单步失败不阻断后续模块（错误码 + 日志明确），便于一次跑完看出全貌。
 *   - 不写入 module.json / 不回写源码；只写 DB（与运行时 toggle 一致）。
 *   - 菜单追加走 sys_menu.path 唯一索引；冲突时 SELECT 后跳过，不报错。
 */

import 'dotenv/config'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import {
  sysMenu,
  sysMenuPermission,
  sysModule,
  sysModuleMigration,
  sysRole,
  sysRoleMenu,
  sysRolePermission,
  sysUser,
} from '@/db/schema'
import { ROLE_CODES } from '@/constants/permission-codes.js'
import { PERMISSION_CODES, registerPermissions } from '@/core/permissions/catalog.js'

// dist/scripts/onboard-modules.js → APP_ROOT_DIST = dist/, APP_ROOT_SRC = src/
const APP_ROOT_DIST = join(__dirname, '..')
const APP_ROOT_SRC = join(APP_ROOT_DIST, '..', 'src')
// drizzle-kit 装在 API 根目录的 node_modules，pnpm 不把它 hoist 进 dist/
const APP_ROOT = join(APP_ROOT_DIST, '..')
const MODULES_SRC = join(APP_ROOT_SRC, 'modules')
const MODULES_DIST = join(APP_ROOT_DIST, 'modules')
const DRIZZLE_KIT = join(APP_ROOT, 'node_modules', '.bin', 'drizzle-kit')

interface ModuleJson {
  id?: string
  build?: boolean
  adminMenu?: ModuleAdminMenuDecl
}

interface ModuleAdminMenuDecl {
  name: string
  path: string
  icon?: string
  component?: string
  parentPath?: string
  sortOrder?: number
  permission: { code: string; label: string; group: string }
}

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
    const routesEntry = join(dir, 'routes.ts')
    if (existsSync(routesEntry) || existsSync(join(MODULES_DIST, id, 'routes.js'))) {
      ids.push(id)
    }
  }
  return ids.sort()
}

function readModuleJson(id: string): ModuleJson {
  const metaPath = join(MODULES_SRC, id, 'module.json')
  if (!existsSync(metaPath)) return {}
  try {
    return JSON.parse(readFileSync(metaPath, 'utf8')) as ModuleJson
  } catch {
    return {}
  }
}

// -----------------------------------------------------------------------------
// Step 1: 迁移
// -----------------------------------------------------------------------------

async function runDrizzleKit(
  cwd: string,
  configFlag: string,
  args: string[],
): Promise<StepOutcome> {
  return new Promise((resolve) => {
    const child = spawn(DRIZZLE_KIT, [configFlag, ...args], { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
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

// -----------------------------------------------------------------------------
// Step 2: seed
// -----------------------------------------------------------------------------

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
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
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

// -----------------------------------------------------------------------------
// Step 3: 菜单追加
// -----------------------------------------------------------------------------

async function findMenuByPath(path: string) {
  return drizzleDb.query.sysMenu.findFirst({
    where: and(eq(sysMenu.path, path), isNull(sysMenu.deletedAt)),
  })
}

async function findMenuByName(parentId: number | null, name: string) {
  const cond =
    parentId === null
      ? and(isNull(sysMenu.parentId), eq(sysMenu.name, name), isNull(sysMenu.deletedAt))
      : and(eq(sysMenu.parentId, parentId), eq(sysMenu.name, name), isNull(sysMenu.deletedAt))
  return drizzleDb.query.sysMenu.findFirst({ where: cond })
}

async function ensureAdminUserId(): Promise<number> {
  const adminUser = await drizzleDb.query.sysUser
    .findFirst({ where: eq(sysUser.username, 'admin') })
    .catch(() => null)
  return adminUser?.id ?? 1
}

async function resolveParentId(parentPath: string | undefined): Promise<number | null> {
  if (!parentPath) return null
  const parent = await findMenuByPath(parentPath)
  return parent?.id ?? null
}

async function ensureSysModuleRow(id: string): Promise<void> {
  // 让 sys_module 行存在；module-loader 启动期也会 sync，这里做兜底保证独立运行也成立。
  const exists = await drizzleDb.query.sysModule.findFirst({ where: eq(sysModule.id, id) })
  if (exists) return
  await drizzleDb.insert(sysModule).values({
    id,
    name: id,
    tablePrefix: `${id}_`,
    version: '0.0.0',
    enabled: 1,
  })
}

async function appendModuleMenu(id: string): Promise<StepOutcome> {
  const moduleJson = readModuleJson(id)
  const decl = moduleJson.adminMenu
  if (!decl) return { ok: true, message: '未声明 adminMenu，跳过菜单追加' }

  // 1) 权限码注册（模块顶层副作用也会做，这里兜底）
  registerPermissions({
    code: decl.permission.code,
    label: decl.permission.label,
    group: decl.permission.group,
  })
  if (!PERMISSION_CODES.has(decl.permission.code)) {
    return { ok: false, message: `权限码注册失败：${decl.permission.code}` }
  }

  // 2) 父菜单解析（按 path；不存在则挂到根）
  const parentId = await resolveParentId(decl.parentPath)

  // 3) sys_menu 行：按 path 唯一，存在则跳过
  const existing = await findMenuByPath(decl.path)
  let menuId: number
  let created = false
  if (existing) {
    menuId = existing.id
  } else {
    const byName = parentId === null ? await findMenuByName(null, decl.name) : await findMenuByName(parentId, decl.name)
    if (byName) {
      menuId = byName.id
    } else {
      const creatorId = await ensureAdminUserId()
      await drizzleDb.insert(sysMenu).values({
        name: decl.name,
        path: decl.path,
        icon: decl.icon,
        component: decl.component,
        type: 1,
        parentId,
        status: 1,
        sortOrder: decl.sortOrder ?? 99,
        hideInMenu: false,
        isDefaultAction: false,
        isExternalLink: false,
        keepAlive: false,
        creatorId,
        updaterId: creatorId,
      } as typeof sysMenu.$inferInsert)
      const created2 = await findMenuByPath(decl.path)
      if (!created2) {
        return { ok: false, message: `菜单写入后未找到: ${decl.path}` }
      }
      menuId = created2.id
      created = true
    }
  }

  // 4) sys_menu_permission 关联（幂等）
  await drizzleDb
    .insert(sysMenuPermission)
    .values({ menuId, permissionCode: decl.permission.code })
    .onDuplicateKeyUpdate({ set: { permissionCode: decl.permission.code } })

  // 5) 绑给 admin + super_admin 角色（幂等）
  const roles = await drizzleDb
    .select({ id: sysRole.id, code: sysRole.code })
    .from(sysRole)
    .where(inArray(sysRole.code, [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN]))
  for (const role of roles) {
    await drizzleDb
      .insert(sysRoleMenu)
      .values({ roleId: role.id, menuId })
      .onDuplicateKeyUpdate({ set: { deletedAt: null } })

    // 同步 sys_role_permission：admin 不应拿到 system:plugin:* 但模块自定义权限码不在排除前缀里。
    await drizzleDb
      .insert(sysRolePermission)
      .values({ roleId: role.id, permissionCode: decl.permission.code, creatorId: menuId })
      .onDuplicateKeyUpdate({ set: { deletedAt: null } })
  }

  await ensureSysModuleRow(id)

  return {
    ok: true,
    message: created ? `已写入 sys_menu(${decl.path}) 并绑定 admin/super_admin` : `sys_menu(${decl.path}) 已存在，跳过写入`,
  }
}

// -----------------------------------------------------------------------------
// 编排
// -----------------------------------------------------------------------------

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
}

main().catch((err) => {
  console.error('onboard-modules 异常退出:', err)
  process.exit(1)
})