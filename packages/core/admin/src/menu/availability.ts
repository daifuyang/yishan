import type { MenuTreeList, MenuTreeNode } from './types'

/** Authorization comes from the server; installation and enablement are separate gates. */
export function filterAvailableMenus(
  menus: MenuTreeList,
  installedModuleIds: readonly string[],
  enabledModuleIds: readonly string[],
  hasComponent: (key: string) => boolean,
): MenuTreeList {
  const installed = new Set(installedModuleIds)
  const enabled = new Set(enabledModuleIds)
  const visit = (menu: MenuTreeNode): MenuTreeNode | null => {
    const moduleId = menu.component?.match(/^\.\/modules\/([^/]+)\//)?.[1]
    if (moduleId && (!installed.has(moduleId) || !enabled.has(moduleId))) return null
    if (menu.component && !menu.isExternalLink && !hasComponent(menu.component)) return null
    const children = (menu.children ?? []).map(visit).filter((child): child is MenuTreeNode => child !== null)
    if (menu.type === 0 && menu.children?.length && children.length === 0) return null
    return { ...menu, children }
  }
  return menus.map(visit).filter((menu): menu is MenuTreeNode => menu !== null)
}
