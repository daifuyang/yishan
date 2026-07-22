import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import {
  accountMenusSeed,
  assertSeedEnvironment,
  deptTreeSeed,
  dictsSeed,
  postsSeed,
  sysOptionsSeed,
  systemMenusSeed,
} from './config.js';
import type { SeedDb } from './context.js';
import { drizzleDb, pool } from '@/db';
import { ensureAdminUser } from './modules/system-user.js';
import { bindUserRole, ensureSystemRoles } from './modules/system-role.js';
import { seedDepartments } from './modules/system-dept.js';
import { seedPosts } from './modules/system-post.js';
import { seedMenus } from './modules/system-menu.js';
import { bindRoleMenusByDefault } from './modules/system-role-menu.js';
import { bindRolePermissionsByDefault } from './modules/system-role-permission.js';
import { seedDicts } from './modules/system-dict.js';
import { seedSysOptions } from './modules/system-option.js';

/**
 * 把 `core/routes/**` 下所有已编译路由模块 import 进来，仅用于触发
 * `registerPermissions(...)` 的模块顶层副作用。运行时由 `@fastify/autoload`
 * 完成同样事情；seed 是独立 Node 进程，不会经过 fastify，所以这里手动扫一遍。
 *
 * 只在第一次调用时执行，结果用模块作用域的 boolean 缓存。
 */
let permissionsLoaded = false;
async function loadCoreRoutePermissions(): Promise<void> {
  if (permissionsLoaded) return;
  permissionsLoaded = true;

  // 编译后 src/scripts/seed/index.js → ../../core/routes
  const routesRoot = join(__dirname, '..', '..', 'core', 'routes');
  const stack: string[] = [routesRoot];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        // 动态 import 仅用于触发模块顶层副作用；不需要返回值。
        await import(full);
      }
    }
  }
}

async function runSeedTransaction(db: SeedDb) {
  const adminUser = await ensureAdminUser(db);
  const { superAdminRole } = await ensureSystemRoles(db, adminUser.id);
  await bindUserRole(db, adminUser.id, superAdminRole.id);

  await seedDepartments(db, adminUser.id, deptTreeSeed);
  await seedPosts(db, adminUser.id, postsSeed);
  await seedMenus(db, adminUser.id, [systemMenusSeed, accountMenusSeed]);
  await bindRoleMenusByDefault(db);
  await bindRolePermissionsByDefault(db, adminUser.id);
  await seedDicts(db, adminUser.id, dictsSeed);
  await seedSysOptions(db, adminUser.id, sysOptionsSeed);
}

const APP_ROOT = join(__dirname, '..', '..', '..')
const ONBOARD_DIST = join(APP_ROOT, 'dist', 'scripts', 'onboard-modules.js')

function spawnOnboard(): Promise<{ code: number; stdout: string; stderr: string }> {
  if (!existsSync(ONBOARD_DIST)) {
    return Promise.reject(
      new Error(
        `找不到 onboard-modules 编译产物：${ONBOARD_DIST}。请先运行 pnpm build:ts。`,
      ),
    )
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [ONBOARD_DIST], {
      cwd: APP_ROOT,
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString() })
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

export async function runSeed() {
  assertSeedEnvironment();
  await loadCoreRoutePermissions();
  console.log('========== yishan seed 编排开始 ==========');
  console.log('Step 1/2: core migrate + seed');

  console.log('[seed] drizzle-kit migrate');
  execSync('npx drizzle-kit migrate', { stdio: 'inherit' });
  console.log('[seed] core migrate 完成');

  await drizzleDb.transaction(async (tx) => {
    await runSeedTransaction(tx as unknown as SeedDb);
  });
  console.log('  core seed 完成');

  console.log('Step 2/2: module migrate + seed (onboard-modules)');
  const onboard = await spawnOnboard();
  process.stdout.write(onboard.stdout);
  if (onboard.stderr) process.stderr.write(onboard.stderr);
  if (onboard.code !== 0) {
    throw new Error(`onboard-modules 退出码 ${onboard.code}`);
  }

  console.log('========== yishan seed 编排完成 ==========');
  await pool.end().catch(() => {});
}

runSeed().catch(async (err) => {
  console.error('[seed] 异常退出:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
