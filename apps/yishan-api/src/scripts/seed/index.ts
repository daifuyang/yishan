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
import { createPluginPersistenceService } from '@/core/plugin-platform/persistence.js';
import type { PluginManifest } from '@/core/plugin-platform/types.js';
// Wave 2: read hello from the catalog (artifacts/plugin-catalog.json) and
// dynamically import its manifest. The previous static import of
// `apps/yishan-api/src/plugins/modules/hello/manifest.js` no longer exists.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { ensureAdminUser } from './modules/system-user.js';
import { bindUserRole, ensureSystemRoles } from './modules/system-role.js';
import { seedDepartments } from './modules/system-dept.js';
import { seedPosts } from './modules/system-post.js';
import { seedMenus } from './modules/system-menu.js';
import { bindRoleMenusByDefault } from './modules/system-role-menu.js';
import { bindRolePermissionsByDefault } from './modules/system-role-permission.js';
import { seedDicts } from './modules/system-dict.js';
import { seedSysOptions } from './modules/system-option.js';

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
  console.log('开始执行种子数据脚本...');

  await drizzleDb.transaction(async (tx) => {
    await runSeedTransaction(tx as unknown as SeedDb);
  });
  console.log('种子数据创建完成');
  await enableBuiltinPlugins();
}

/** Keep the platform exercised on main without bringing business modules in. */
async function enableBuiltinPlugins(): Promise<void> {
  const repoRoot = join(process.cwd(), '..', '..');
  const catalogPath = join(repoRoot, 'artifacts', 'plugin-catalog.json');
  interface CatalogEntry { id: string; kind?: 'sample' | 'production' }
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as { plugins: CatalogEntry[] };
  const persistence = createPluginPersistenceService(console);
  // Wave 2: walk every catalog entry (currently just `yishan/hello`) and
  // enable it. We resolve the manifest by dynamic import so the seed script
  // stays consistent with the catalog-driven boot path in `app.ts`.
  for (const entry of catalog.plugins) {
    try {
      const manifestPath = join(repoRoot, 'plugins', entry.id, 'plugin.ts');
      const mod = (await import(manifestPath)) as { default?: unknown };
      const manifest = mod.default as PluginManifest;
      await persistence.syncManifest(manifest);
      await persistence.updateRuntimeStateStrict(
        manifest.pluginId,
        manifest.name,
        'enabled',
        true,
      );
      console.log(`  ✓ ${manifest.pluginId} (${manifest.name}) enabled`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  ! seed: enable plugin ${entry.id} failed: ${message}`);
    }
  }
}
