import {
  accountMenusSeed,
  assertSeedEnvironment,
  deptTreeSeed,
  dictsSeed,
  portalArticlesSeed,
  portalCategoriesSeed,
  portalPagesSeed,
  portalTemplatesSeed,
  postsSeed,
  sysOptionsSeed,
  systemMenusSeed,
} from './config.js';
import type { SeedDb } from './context.js';
import { drizzleDb } from '@/db';
import { createPluginPersistenceService } from '../../plugins-runtime/persistence.js';
import type { PluginManifest } from '../../plugins-runtime/types.js';
import helloManifest from '../../plugins/modules/hello/manifest.js';
import portalManifest from '../../plugins/modules/portal/manifest.js';
import shopManifest from '../../plugins/modules/shop/manifest.js';
import { ensureAdminUser } from './modules/system-user.js';
import { bindUserRole, ensureSystemRoles } from './modules/system-role.js';
import { seedDepartments } from './modules/system-dept.js';
import { seedPosts } from './modules/system-post.js';
import { seedMenus } from './modules/system-menu.js';
import { bindRoleMenusByDefault } from './modules/system-role-menu.js';
import { seedDicts } from './modules/system-dict.js';
import { seedPortalCategories, seedPortalArticles, seedPortalPages } from './modules/portal-content.js';
import { seedPortalTemplates } from './modules/portal-template.js';
import { seedSysOptions } from './modules/system-option.js';

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

  const categorySlugToId = await seedPortalCategories(db, adminUser.id, portalCategoriesSeed);
  await seedPortalPages(db, adminUser.id, portalPagesSeed);
  await seedPortalTemplates(db, adminUser.id, portalTemplatesSeed);
  await seedPortalArticles(db, adminUser.id, portalArticlesSeed, categorySlugToId);
}

export async function runSeed() {
  assertSeedEnvironment();
  console.log('开始执行种子数据脚本...');

  await drizzleDb.transaction(async (tx) => {
    await runSeedTransaction(tx as unknown as SeedDb);
  });
  console.log('种子数据创建完成');

  await enableBuiltinPlugins();
}

/**
 * 默认启用三个内置插件（hello / portal / shop）。
 *
 * 背景：seed 之前只创建用户/角色/部门/菜单/字典，sys_plugin 表留空，
 * 导致 db:reset 后启动 API 时活动权限目录为空，所有插件接口 403。
 *
 * 这里使用与 PluginManageService.enablePlugin 一致的持久化链路：
 *   1) syncManifest — 写 manifest 到 sys_plugin
 *   2) updateRuntimeStateStrict('enabled', true) — 严格写 enabled
 *
 * 注意：菜单同步在 API 启动阶段由 app.ts 处理（PluginMenuSyncService），
 * seed 只负责落库，runtime.lifecycle.enable 由启动流程完成。
 */
async function enableBuiltinPlugins(): Promise<void> {
  // manifest 文件使用 `as const` 导出，类型与 PluginManifest 不完全兼容
  // （readonly + 多余字段 routes），运行期结构一致，做一次类型断言即可
  const builtins = [
    { manifest: helloManifest as unknown as PluginManifest },
    { manifest: portalManifest as unknown as PluginManifest },
    { manifest: shopManifest as unknown as PluginManifest },
  ]
  const persistence = createPluginPersistenceService(console)

  console.log('开始启用内置插件...')
  for (const { manifest } of builtins) {
    await persistence.syncManifest(manifest)
    await persistence.updateRuntimeStateStrict(
      manifest.pluginId,
      manifest.name,
      'enabled',
      true,
    )
    console.log(`  ✓ ${manifest.pluginId} (${manifest.name}) enabled`)
  }
  console.log('内置插件启用完成')
}
