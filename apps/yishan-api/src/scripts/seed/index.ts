import { readdirSync } from 'node:fs';
import { join } from 'node:path';
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
import { drizzleDb } from '@/db';
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

export async function runSeed() {
  assertSeedEnvironment();
  await loadCoreRoutePermissions();
  console.log('开始执行种子数据脚本...');

  await drizzleDb.transaction(async (tx) => {
    await runSeedTransaction(tx as unknown as SeedDb);
  });
  console.log('种子数据创建完成');
}
