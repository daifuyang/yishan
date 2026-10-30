/**
 * iximei-crm 模块的种子入口。
 *
 * 由 `apps/iximei-crm/api/src/scripts/seed.ts` 在 system seed 之后调用，
 * 也可以单独 `node dist/modules/iximei_crm/seed.js` 跑（幂等）。
 *
 * 三件事：
 *   1. 从 config/system-menu.json 递归写入 sys_menu
 *   2. 把按钮权限码绑定到 sys_menu_permission
 *   3. 按角色矩阵重绑 sys_role_permission（见 seed-role-permissions.ts）
 */

import { eq } from 'drizzle-orm'
import { drizzleDb } from '@yishan/core-system-api/database'
import { sysMenu, sysMenuPermission, sysUser } from '@yishan/core-system-api/schema'
import adminMenu from './config/system-menu.json'
import { bindRolePermissionsByDefault } from './seed-role-permissions'

export type AdminMenuNode = {
  type: 0 | 1 | 2
  name: string
  path?: string
  sortOrder: number
  icon?: string
  component?: string
  hideInMenu?: 0 | 1
  permissionCodes?: string[]
  isDefaultAction?: 0 | 1
  children?: AdminMenuNode[]
}

const menuTree = adminMenu as AdminMenuNode[]

export const toBool = (n: 0 | 1 | undefined): boolean => n === 1

export type FlatNode = {
  node: AdminMenuNode
  depth: number
  parentPath: string | null
}

export function flattenMenuTree(nodes: AdminMenuNode[]): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (list: AdminMenuNode[], depth: number, parentPath: string | null): void => {
    for (const node of list) {
      const myPath = node.path ?? parentPath
      out.push({ node, depth, parentPath })
      if (node.children && node.children.length > 0) {
        walk(node.children, depth + 1, myPath)
      }
    }
  }
  walk(nodes, 0, null)
  return out
}

async function upsertTree(
  nodes: AdminMenuNode[],
  parentId: number | null,
  creatorId: number,
): Promise<void> {
  for (const decl of nodes) {
    const id = await upsertOne(decl, parentId, creatorId)
    if (decl.children && decl.children.length > 0) {
      await upsertTree(decl.children, id, creatorId)
    }
  }
}

async function upsertOne(
  decl: AdminMenuNode,
  parentId: number | null,
  creatorId: number,
): Promise<number> {
  if (!decl.path) {
    return parentId ?? 0
  }
  const existing = await drizzleDb.query.sysMenu.findFirst({
    where: eq(sysMenu.path, decl.path),
  })
  if (existing) {
    await drizzleDb
      .update(sysMenu)
      .set({
        name: decl.name,
        type: decl.type,
        parentId,
        component: decl.component ?? existing.component,
        icon: decl.icon,
        sortOrder: decl.sortOrder,
        updaterId: creatorId,
        status: 1,
        hideInMenu: toBool(decl.hideInMenu),
      })
      .where(eq(sysMenu.id, existing.id))
    return existing.id
  }
  await drizzleDb.insert(sysMenu).values({
    name: decl.name,
    path: decl.path,
    type: decl.type,
    parentId,
    component: decl.component,
    icon: decl.icon,
    sortOrder: decl.sortOrder ?? 99,
    status: 1,
    hideInMenu: toBool(decl.hideInMenu),
    isDefaultAction: toBool(decl.isDefaultAction),
    isExternalLink: false,
    keepAlive: false,
    creatorId,
    updaterId: creatorId,
  } as never)
  const created = await drizzleDb.query.sysMenu.findFirst({
    where: eq(sysMenu.path, decl.path),
  })
  if (!created) {
    throw new Error(`菜单写入后未找到：${decl.path}`)
  }
  return created.id
}

async function bindMenuPermissions(menuId: number, codes: string[]): Promise<void> {
  if (codes.length === 0) return
  for (const code of codes) {
    await drizzleDb
      .insert(sysMenuPermission)
      .values({ menuId, permissionCode: code })
      .onDuplicateKeyUpdate({ set: { permissionCode: code } })
  }
}

async function bindAllPermissions(flat: FlatNode[]): Promise<void> {
  for (const { node, parentPath } of flat) {
    if (!node.permissionCodes || node.permissionCodes.length === 0) continue
    const anchorPath = node.path ?? parentPath
    if (!anchorPath) {
      throw new Error(`bindAllPermissions 找不到可绑定的菜单行：${node.name}`)
    }
    const row = await drizzleDb.query.sysMenu.findFirst({
      where: eq(sysMenu.path, anchorPath),
    })
    if (!row) {
      throw new Error(`bindAllPermissions 找不到菜单：${anchorPath}`)
    }
    await bindMenuPermissions(row.id, node.permissionCodes)
  }
}

export default async function seedCrm(): Promise<void> {
  const [admin] = await drizzleDb
    .select({ id: sysUser.id })
    .from(sysUser)
    .where(eq(sysUser.username, 'admin'))
    .limit(1)
  const creatorId = admin?.id ?? 1

  await upsertTree(menuTree, null, creatorId)
  const flat = flattenMenuTree(menuTree)
  await bindAllPermissions(flat)

  // 菜单写完再绑角色权限：权限码必须先在 permission catalog 里注册过
  // （permissions.ts 在 import 时完成注册），否则 role_permission 会指向空码。
  await bindRolePermissionsByDefault(drizzleDb, creatorId)

  console.log('iximei-crm seed: 菜单与角色权限已写入')
}

if (require.main === module) {
  seedCrm().catch((err) => {
    console.error('[crm seed] 异常退出:', err)
    process.exit(1)
  })
}
