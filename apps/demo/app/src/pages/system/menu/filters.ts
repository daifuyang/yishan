import type { AdminMenu } from '@/api/admin/menu'
import { menuResourceType, menuTypeLabel } from '@/components/management/menuResourceTypes'

// 类型文案统一由 MenuTypeBadge 提供，避免列表、详情、表单各写一套
export const MENU_TYPE_OPTIONS = [
  { key: '', label: '全部类型' },
  { key: '0', label: menuTypeLabel(menuResourceType(0)) },
  { key: '1', label: menuTypeLabel(menuResourceType(1)) },
  { key: '2', label: menuTypeLabel(menuResourceType(2)) },
] as const

export const MENU_STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

export const MENU_TYPE_LABELS: Record<AdminMenu['type'], string> = {
  0: menuTypeLabel(menuResourceType(0)),
  1: menuTypeLabel(menuResourceType(1)),
  2: menuTypeLabel(menuResourceType(2)),
}

/** 目录与页面有子节点，按钮是叶子；只有非叶子节点才允许挂下级。 */
export function menuCanHaveChildren(type: AdminMenu['type']): boolean {
  return type !== 2
}

export interface MenuFilters {
  type: string
  status: string
}

export const DEFAULT_MENU_FILTERS: MenuFilters = {
  type: '',
  status: '',
}

export function readMenuFilters(filters: Record<string, unknown>): MenuFilters {
  return {
    type: typeof filters.type === 'string' ? filters.type : DEFAULT_MENU_FILTERS.type,
    status: typeof filters.status === 'string' ? filters.status : DEFAULT_MENU_FILTERS.status,
  }
}

/** 关键词命中：名称、路由路径、组件路径都算，运维常常只记得其中之一。 */
export function menuMatches(node: AdminMenu, needle: string): boolean {
  return `${node.name} ${node.path || ''} ${node.component || ''}`
    .toLowerCase()
    .includes(needle)
}

/** 类型/状态筛选保留命中的节点和它的祖先链，否则父级被筛掉后子节点就成了孤儿。 */
export function filterMenuTree(
  nodes: readonly AdminMenu[],
  filters: MenuFilters,
): AdminMenu[] {
  const keep = (node: AdminMenu): AdminMenu | null => {
    const children = (node.children ?? []).flatMap((child) => {
      const matched = keep(child)
      return matched ? [matched] : []
    })
    const typeOk = !filters.type || String(node.type) === filters.type
    const statusOk = !filters.status || node.status === filters.status
    if ((typeOk && statusOk) || children.length) {
      return { ...node, children }
    }
    return null
  }
  return nodes.flatMap((node) => {
    const matched = keep(node)
    return matched ? [matched] : []
  })
}
