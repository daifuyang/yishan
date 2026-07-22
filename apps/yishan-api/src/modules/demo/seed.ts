/**
 * demo 模块的种子入口。
 *
 * 编排脚本（scripts/onboard-modules.ts）通过 `seedModule()` 顶层副作用触发本文件：
 *   - 从 ./config/system-menu.json 读取模块菜单树，递归铺平写入 sys_menu
 *   - 把按钮对应的权限码绑到 sys_menu_permission
 *
 * 模块自身的 drizzle migration 已经在 migrate 步骤写过表与预置数据；
 * sys_module 行的首次写入由 core/module-loader 统一负责，本文件不再重复。
 */

import { eq } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { sysMenu, sysMenuPermission, sysUser } from '@/db/schema'
import adminMenu from './config/system-menu.json'

/**
 * demo 菜单的本地宽松类型。JSON 里所有"是否"字段都用 0/1 而非 true/false，
 * 与 core 的 MenuSeedNode（boolean）不直接兼容；seed.ts 在写入时按位适配。
 * 任何节点都可以挂 children（type=0 目录 / 1 页面 / 2 按钮都允许嵌套）。
 */
export type AdminMenuNode = {
  type: 0 | 1 | 2;
  name: string;
  path?: string;
  sortOrder: number;
  icon?: string;
  component?: string;
  hideInMenu?: 0 | 1;
  permissionCodes?: string[];
  isDefaultAction?: 0 | 1;
  children?: AdminMenuNode[];
}

const menuTree = adminMenu as AdminMenuNode[]

/** 把 0/1 转成布尔（DB schema 用 0/1，这里只是中转） */
export const toBool = (n: 0 | 1 | undefined): boolean => n === 1

/**
 * 把菜单树递归铺平成「插入顺序」的节点列表，保留父子层数（depth）。
 *
 *   depth=0 表示顶级（直接挂在 sys_menu.parentId=null），
 *   depth=N 表示挂在铺平后第 N-1 层父节点下。
 *
 * 这是纯函数：同一份 JSON 总是产生同一份列表，便于单测断言。
 * 无限级 children 都能正确展开。
 */
export type FlatNode = {
  node: AdminMenuNode;
  depth: number;
  /** 最近的有 path 的祖先 path（按钮的权限码绑到这）；顶级为 null。 */
  parentPath: string | null;
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

/**
 * 递归 upsert 单棵菜单子树。
 *   - 先 upsert 当前节点
 *   - 递归 children（type 不限：目录可挂页面/按钮，页面也可挂子按钮）
 *   - 返回当前节点 id，供父节点挂 parentId
 */
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
  console.log(`[seed] upsertMenu start: ${decl.path ?? '(no path, type=' + decl.type + ')'} (type=${decl.type})`)
  if (!decl.path) {
    // 按钮节点（type=2）通常不参与前端路由，没有独立 path；
    // 它挂在其父页面的同一 row 下，权限码由 bindMenuPermissions 处理。
    return parentId ?? 0
  }
  const existing = await drizzleDb.query.sysMenu.findFirst({
    where: eq(sysMenu.path, decl.path),
  })
  console.log(`[seed]   findFirst existing: ${existing?.id ?? 'none'}`)
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
    console.log(`[seed]   updated ${decl.path} -> id=${existing.id}`)
    return existing.id
  }
  console.log(`[seed]   inserting ${decl.path}...`)
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
  console.log(`[seed]   inserted ${decl.path}, querying back...`)
  const created = await drizzleDb.query.sysMenu.findFirst({
    where: eq(sysMenu.path, decl.path),
  })
  if (!created) {
    throw new Error(`菜单写入后未找到：${decl.path}`)
  }
  console.log(`[seed]   inserted -> id=${created.id}`)
  return created.id
}

async function bindMenuPermissions(menuId: number, codes: string[]): Promise<void> {
  if (codes.length === 0) return
  console.log(`[seed] bindMenuPermissions start: menuId=${menuId} codes=${codes.join(',')}`)
  for (const code of codes) {
    console.log(`[seed]   binding code '${code}' to menu ${menuId}...`)
    await drizzleDb
      .insert(sysMenuPermission)
      .values({ menuId, permissionCode: code })
      .onDuplicateKeyUpdate({ set: { permissionCode: code } })
    console.log(`[seed]   bound '${code}'`)
  }
}

/**
 * 收集整棵子树里所有节点（含根和叶）的 permissionCodes，按节点 id 绑到 sys_menu_permission。
 *
 * 按钮节点（type=2，无 path）的权限码绑定到「最近的有 path 的祖先」
 * —— 通常是父页面；菜单表中不存在独立按钮行，所有按钮共享父页面的 row。
 *
 * parentPath 已经由 flattenMenuTree 计算好，这里直接用，不再做树形查找。
 */
async function bindAllPermissions(
  flat: FlatNode[],
  creatorId: number,
): Promise<void> {
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

export default async function seedDemo(): Promise<void> {
  console.log('[seed] seedDemo: enter')
  const [admin] = await drizzleDb
    .select({ id: sysUser.id })
    .from(sysUser)
    .where(eq(sysUser.username, 'admin'))
    .limit(1)
  const creatorId = admin?.id ?? 1
  console.log(`[seed] seedDemo: creatorId=${creatorId}`)

  await upsertTree(menuTree, null, creatorId)
  const flat = flattenMenuTree(menuTree)
  await bindAllPermissions(flat, creatorId)

  console.log('demo seed: 菜单已写入（递归铺平自 ./config/system-menu.json）')
}

// 模块顶层自动执行：onboard-modules.ts 通过 spawn `node seed.js` 触发，
// 编译产物仅 export default，不会主动调用，所以这里必须显式触发。
//
// 用 `require.main === module` 守卫：只在被 Node 直接执行时才跑，
// 被其它模块 import（单测、依赖图扫描等）时不跑 —— 否则单测会触发 DB 连接。
if (require.main === module) {
  seedDemo().catch((err) => {
    console.error('[demo seed] 异常退出:', err)
    process.exit(1)
  })
}