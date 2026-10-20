import { resolveSeedActor, seedModuleMenus, type MenuSeedNode } from '@yishan/core-system-api'
import adminMenu from './config/system-menu.json'

export default async function seedAi(): Promise<void> {
  const actor = await resolveSeedActor()
  const nodes: MenuSeedNode[] = adminMenu.map(node => ({
    ...node,
    type: 1,
    children: node.children.map(child => ({ ...child, type: 2, hideInMenu: child.hideInMenu === 1, isDefaultAction: child.isDefaultAction === 1 })),
  }))
  await seedModuleMenus('ai', nodes, actor?.id ?? 1)
}
