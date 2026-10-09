import { accountMenusSeed, assertSeedEnvironment, deptTreeSeed, dictsSeed, postsSeed, sysOptionsSeed, systemMenusSeed, type MenuSeedNode } from './config'
import type { SeedDb } from './context'
import { drizzleDb } from '../../db'
import { currentSystemRuntime } from '../../runtime'
import { ensureAdminUser } from './modules/system-user'
import { bindUserRole, ensureSystemRoles } from './modules/system-role'
import { seedDepartments } from './modules/system-dept'
import { seedPosts } from './modules/system-post'
import { seedMenus, seedProductMenus } from './modules/system-menu'
import { bindRoleMenusByDefault } from './modules/system-role-menu'
import { bindRolePermissionsByDefault } from './modules/system-role-permission'
import { seedDicts } from './modules/system-dict'
import { seedSysOptions } from './modules/system-option'
import { seedRegions } from './modules/system-region'
import { eq, inArray } from 'drizzle-orm'
import { sysEnum, sysMenu, sysMenuPermission, sysRoleMenu, sysRolePermission, sysUser } from '../../db/schema'
import type { UserIdentity } from '@yishan/core-contracts'

async function runSeedTransaction(db: SeedDb) {
  const { user: adminUser, created: adminCreated } = await ensureAdminUser(db);
  const { superAdminRole, createdRoleIds } = await ensureSystemRoles(db, adminUser.id);
  if (adminCreated) await bindUserRole(db, adminUser.id, superAdminRole.id);

  await seedDepartments(db, adminUser.id, deptTreeSeed);
  await seedPosts(db, adminUser.id, postsSeed);
  await seedMenus(db, adminUser.id, [systemMenusSeed, accountMenusSeed]);
  await bindRoleMenusByDefault(db, createdRoleIds);
  await bindRolePermissionsByDefault(db, adminUser.id, createdRoleIds);
  await seedDicts(db, adminUser.id, dictsSeed);
  await seedSysOptions(db, adminUser.id, sysOptionsSeed);
  await seedRegions(db);
  return createdRoleIds;
}


export async function seedSystem(): Promise<void> {
  assertSeedEnvironment();
  const createdRoleIds = await drizzleDb.transaction(tx => runSeedTransaction(tx as unknown as SeedDb));
  for (const id of createdRoleIds) currentSystemRuntime().pendingSeedRoleIds.add(id);
}

export async function finalizeSystemSeed(): Promise<void> {
  const runtime = currentSystemRuntime();
  const roleIds = [...runtime.pendingSeedRoleIds];
  if (!roleIds.length) return;
  await drizzleDb.transaction(async tx => {
    const [admin] = await tx.select({ id: sysUser.id }).from(sysUser).where(eq(sysUser.username, 'admin')).limit(1);
    if (!admin) throw new Error('Seed System identities before finalizing product menus');
    await bindRoleMenusByDefault(tx as unknown as SeedDb, roleIds);
    await bindRolePermissionsByDefault(tx as unknown as SeedDb, admin.id, roleIds);
  });
  runtime.pendingSeedRoleIds.clear();
  runtime.caches.permissions.clear();
}

function assertContributionModule(moduleId: string): void {
  if (!/^[a-z0-9_]{1,24}$/.test(moduleId) || moduleId === 'system' || moduleId === 'sys') throw new Error(`Invalid business contribution module: ${moduleId}`);
}

function assertOwnedValue(moduleId: string, value: string, kind: 'path' | 'permission' | 'enum'): void {
  const valid = kind === 'path'
    ? value === `/${moduleId}` || value.startsWith(`/${moduleId}/`)
    : value.startsWith(`${moduleId}${kind === 'permission' ? ':' : '_'}`);
  if (!valid) throw new Error(`Module ${moduleId} cannot contribute ${kind}: ${value}`);
}

export interface ModuleMenuSeedOptions {
  allowedSystemPermissionCodes?: readonly string[]
}

export async function seedModuleMenus(moduleId: string, nodes: MenuSeedNode[], creatorId = 1, options: ModuleMenuSeedOptions = {}): Promise<void> {
  assertContributionModule(moduleId);
  const runtime = currentSystemRuntime();
  const systemReferences = new Set(options.allowedSystemPermissionCodes ?? []);
  for (const code of systemReferences) {
    if (!runtime.caches.systemPermissionCodes.has(code) || !runtime.permissions.has(code)) {
      throw new Error(`Referenced permission ${code} is not an active System permission`);
    }
  }
  const stack = [...nodes];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.path) assertOwnedValue(moduleId, node.path, 'path');
    for (const code of node.permissionCodes ?? []) {
      if (!systemReferences.has(code)) assertOwnedValue(moduleId, code, 'permission');
    }
    stack.push(...node.children ?? []);
  }
  await drizzleDb.transaction(tx => seedProductMenus(tx as unknown as SeedDb, creatorId, nodes));
  currentSystemRuntime().caches.permissions.clear();
}

export async function resolveSeedActor(): Promise<UserIdentity | null> {
  const [row] = await drizzleDb.select({ id: sysUser.id }).from(sysUser).where(eq(sysUser.username, 'admin')).limit(1);
  return row ? currentSystemRuntime().users.findById(row.id) : null;
}

export async function seedModuleEnums(moduleId: string, items: readonly { type: string; code: string; name: string; sort: number; remark?: string | null }[], creatorId = 1): Promise<void> {
  assertContributionModule(moduleId);
  for (const item of items) assertOwnedValue(moduleId, item.type, 'enum');
  for (const item of items) {
    await drizzleDb.insert(sysEnum).values({ ...item, enabled: 1, creatorId, updaterId: creatorId }).onDuplicateKeyUpdate({ set: { code: item.code } });
  }
  currentSystemRuntime().caches.enums.clear();
}

export async function purgeModuleSeedDeclarations(moduleId: string, declarations: { menuPaths: readonly string[]; permissionCodes: readonly string[]; enumTypes: readonly string[] }): Promise<void> {
  assertContributionModule(moduleId);
  for (const path of declarations.menuPaths) assertOwnedValue(moduleId, path, 'path');
  for (const code of declarations.permissionCodes) assertOwnedValue(moduleId, code, 'permission');
  for (const type of declarations.enumTypes) assertOwnedValue(moduleId, type, 'enum');
  await drizzleDb.transaction(async tx => {
    if (declarations.enumTypes.length) await tx.delete(sysEnum).where(inArray(sysEnum.type, [...declarations.enumTypes]));
    if (declarations.menuPaths.length) {
      const rows = await tx.select({ id: sysMenu.id }).from(sysMenu).where(inArray(sysMenu.path, [...declarations.menuPaths]));
      const ids = rows.map(row => row.id);
      if (ids.length) {
        await tx.delete(sysMenuPermission).where(inArray(sysMenuPermission.menuId, ids));
        await tx.delete(sysRoleMenu).where(inArray(sysRoleMenu.menuId, ids));
        await tx.delete(sysMenu).where(inArray(sysMenu.id, ids));
      }
    }
    if (declarations.permissionCodes.length) await tx.delete(sysRolePermission).where(inArray(sysRolePermission.permissionCode, [...declarations.permissionCodes]));
  });
  currentSystemRuntime().caches.permissions.clear();
  currentSystemRuntime().caches.enums.clear();
}
