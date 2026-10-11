import type { AdminAppMenu } from '@/api/admin/appMenu'
import type { AdminMenu, AdminPermission } from '@/api/admin/menu'

/** 权限分组：模块名 + 成员名，不暴露关联 ID。 */
export interface PermissionGroup {
  name: string
  items: string[]
}

export interface PermissionSelection {
  menuIds: number[]
  permissionCodes: string[]
  appMenuIds: number[]
}

export function flattenMenus(nodes: readonly AdminMenu[]): AdminMenu[] {
  return nodes.flatMap((node) => [node, ...flattenMenus(node.children || [])])
}

/**
 * 把角色的菜单授权折成分组展示：目录为组名，菜单与按钮为成员。
 * 只展示 type 1（菜单）；按钮权限单独走 permissionCodes。
 */
export function groupMenuPermissions(
  menuIds: readonly number[] | undefined,
  menus: readonly AdminMenu[],
): PermissionGroup[] {
  if (!menuIds?.length) return []
  const selected = new Set(menuIds)
  return flattenMenus(menus)
    .filter((node) => node.type === 1 && selected.has(node.id))
    .map((node) => ({ node, group: groupNameOf(node, menus) }))
    .reduce<PermissionGroup[]>((groups, { node, group }) => {
      const existing = groups.find((item) => item.name === group)
      if (existing) existing.items.push(node.name)
      else groups.push({ name: group, items: [node.name] })
      return groups
    }, [])
}

function groupNameOf(node: AdminMenu, menus: readonly AdminMenu[]): string {
  const flat = flattenMenus(menus)
  let current: AdminMenu | undefined = node
  while (current?.parentId) {
    const parent = flat.find((item) => item.id === current?.parentId)
    if (!parent) break
    if (parent.type === 0) return parent.name
    current = parent
  }
  return '其他'
}

/** 把权限码目录按 group 分组，未授权的码不展示。 */
export function groupPermissionCodes(
  permissionCodes: readonly string[] | undefined,
  catalog: readonly AdminPermission[],
): PermissionGroup[] {
  if (!permissionCodes?.length) return []
  const byCode = new Map(catalog.map((item) => [item.code, item]))
  const selected = permissionCodes.filter((code) => byCode.has(code))
  return selected.reduce<PermissionGroup[]>((groups, code) => {
    const item = byCode.get(code)
    if (!item) return groups
    const name = item.group || '其他'
    const existing = groups.find((group) => group.name === name)
    if (existing) existing.items.push(item.label)
    else groups.push({ name, items: [item.label] })
    return groups
  }, [])
}

/** 工作台入口授权同样按分组展示。 */
export function groupAppMenuPermissions(
  appMenuIds: readonly number[] | undefined,
  groups: readonly AdminAppMenu[],
): PermissionGroup[] {
  if (!appMenuIds?.length) return []
  const selected = new Set(appMenuIds)
  return groups
    .map((group) => ({
      name: group.name,
      items: (group.children || [])
        .filter((entry) => selected.has(entry.id))
        .map((entry) => entry.name),
    }))
    .filter((group) => group.items.length > 0)
}

/**
 * 生成提交给后端的授权载荷。
 * 后端把 type 2（按钮）节点拆到 permissionCodes，因此这里需要分离。
 */
export function buildRoleAuthorization(
  selection: PermissionSelection,
  menus: readonly AdminMenu[],
  appMenuGroups: readonly AdminAppMenu[],
) {
  const actionIds = new Set(
    flattenMenus(menus)
      .filter((node) => node.type === 2)
      .map((node) => node.id),
  )
  const entryIds = new Set(
    appMenuGroups.flatMap((group) => (group.children || []).map((entry) => entry.id)),
  )
  const selectedEntries = [...new Set(selection.appMenuIds.filter((id) => entryIds.has(id)))]
  return {
    menuIds: [...new Set(selection.menuIds.filter((id) => !actionIds.has(id)))],
    permissionCodes: [...new Set(selection.permissionCodes)],
    appMenuIds: [
      ...selectedEntries,
      ...appMenuGroups
        .filter((group) =>
          (group.children || []).some((entry) => selectedEntries.includes(entry.id)),
        )
        .map((group) => group.id),
    ],
  }
}

/** 父节点半选：子节点部分选中时父节点应显示为半选而非全选。 */
export function parentCheckState(
  parent: AdminMenu,
  selected: ReadonlySet<number>,
): 'checked' | 'unchecked' | 'indeterminate' {
  const children = (parent.children || []).filter((node) => node.type !== 2)
  if (children.length === 0) return selected.has(parent.id) ? 'checked' : 'unchecked'
  const hit = children.filter((child) => selected.has(child.id)).length
  if (hit === 0) return 'unchecked'
  return hit === children.length ? 'checked' : 'indeterminate'
}
