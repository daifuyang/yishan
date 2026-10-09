/**
 * shop 模块的种子入口。
 *
 * 读取 config/system-menu.json，经公开 System 服务写入菜单与权限声明。
 */

import { resolveSeedActor, seedModuleMenus, type MenuSeedNode } from '@yishan/core-system-api'
import adminMenu from './config/system-menu.json'

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

export type FlatNode = { node: AdminMenuNode; depth: number; parentPath: string | null }

export function flattenMenuTree(nodes: AdminMenuNode[]): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (list: AdminMenuNode[], depth: number, parentPath: string | null): void => {
    for (const node of list) {
      const myPath = node.path ?? parentPath
      out.push({ node, depth, parentPath })
      if (node.children && node.children.length > 0) walk(node.children, depth + 1, myPath)
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

export default async function seedShop(): Promise<void> {
  const admin = await resolveSeedActor()
  const creatorId = admin?.id ?? 1

  await seedModuleMenus('shop', toMenuSeedNodes(menuTree), creatorId)
}
