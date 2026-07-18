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
import { seedDicts } from './modules/system-dict.js';
import { seedSysOptions } from './modules/system-option.js';
import { seedCrm } from './modules/crm.js';

async function runSeedTransaction(db: SeedDb) {
  const adminUser = await ensureAdminUser(db);
  const { superAdminRole } = await ensureSystemRoles(db, adminUser.id);
  await bindUserRole(db, adminUser.id, superAdminRole.id);

  await seedDepartments(db, adminUser.id, deptTreeSeed);
  await seedPosts(db, adminUser.id, postsSeed);
  await seedMenus(db, adminUser.id, [systemMenusSeed, accountMenusSeed]);
  // Section 1 — RBAC：菜单创建后立刻绑定角色，否则后续 requirePermission 不会放行。
  await bindRoleMenusByDefault(db, adminUser.id);
  await seedDicts(db, adminUser.id, dictsSeed);
  await seedSysOptions(db, adminUser.id, sysOptionsSeed);
  await seedCrm(db, adminUser.id);

}

export async function runSeed() {
  assertSeedEnvironment();
  console.log('开始执行种子数据脚本...');

  await drizzleDb.transaction(async (tx) => {
    await runSeedTransaction(tx as unknown as SeedDb);
  });
  console.log('种子数据创建完成');

}
