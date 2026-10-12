import type { AdminAppMenu } from '@/api/admin/appMenu'
import type { AdminMenu } from '@/api/admin/menu'

export function flattenMenus(nodes: readonly AdminMenu[]): AdminMenu[] {
  return nodes.flatMap((node) => [node, ...flattenMenus(node.children || [])])
}

export function buildRoleAuthorization(
  selection: { menuIds: number[]; permissionCodes: string[]; appMenuIds: number[] },
  menus: readonly AdminMenu[],
  groups: readonly AdminAppMenu[],
) {
  const actions = new Set(
    flattenMenus(menus)
      .filter((node) => node.type === 2)
      .map((node) => node.id),
  )
  const entries = new Set(
    groups.flatMap((group) => (group.children || []).map((entry) => entry.id)),
  )
  const selectedEntries = [...new Set(selection.appMenuIds.filter((id) => entries.has(id)))]
  return {
    menuIds: [...new Set(selection.menuIds.filter((id) => !actions.has(id)))],
    permissionCodes: [...new Set(selection.permissionCodes)],
    appMenuIds: [
      ...selectedEntries,
      ...groups
        .filter((group) =>
          (group.children || []).some((entry) => selectedEntries.includes(entry.id)),
        )
        .map((group) => group.id),
    ],
  }
}
