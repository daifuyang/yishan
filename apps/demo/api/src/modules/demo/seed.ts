/**
 * demo 模块的种子入口。
 *
 * 从 ./config/system-menu.json 读取菜单声明，经公开 System 服务写入。
 *
 * 模块自身的 drizzle migration 已经在 migrate 步骤写过表与预置数据；
 * sys_module 行的首次写入由 core/module-loader 统一负责，本文件不再重复。
 */

import { resolveSeedActor, seedModuleMenus, type MenuSeedNode } from '@yishan/core-system-api'
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

function toMenuSeedNodes(nodes: AdminMenuNode[]): MenuSeedNode[] {
  return nodes.map((node) => ({
    ...node,
    hideInMenu: toBool(node.hideInMenu),
    isDefaultAction: toBool(node.isDefaultAction),
    children: node.children ? toMenuSeedNodes(node.children) : undefined,
  }))
}

export default async function seedDemo(): Promise<void> {
  console.log('[seed] seedDemo: enter')
  const admin = await resolveSeedActor()
  const creatorId = admin?.id ?? 1
  console.log(`[seed] seedDemo: creatorId=${creatorId}`)

  await seedModuleMenus('demo', toMenuSeedNodes(menuTree), creatorId, {
    allowedSystemPermissionCodes: ['region:list', 'region:tree', 'region:path', 'region:read'],
  })

  console.log('demo seed: 菜单已写入（递归铺平自 ./config/system-menu.json）')
}
