import type { TreeNode } from '@/components/management/menuTreeLogic'

/**
 * 菜单管理与工作台管理共用的类型/状态筛选。两张表的节点都有数字 type 和
 * '0' | '1' 的 status，筛选语义完全相同，不该各写一份。
 */

export interface TreeFilterOption {
  key: string
  label: string
}

export interface TreeFilters {
  type: string
  status: string
}

export const DEFAULT_TREE_FILTERS: TreeFilters = { type: '', status: '' }

export const TREE_STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

export interface FilterableNode {
  type: number
  status: string
}

/** 类型/状态筛选保留命中的节点和它的祖先链，否则父级被筛掉后子节点就成了孤儿。 */
export function filterTreeByTypeStatus<T extends FilterableNode & TreeNode<T>>(
  nodes: readonly T[],
  filters: TreeFilters,
): T[] {
  const keep = (node: T): T | null => {
    const children = (node.children ?? []).flatMap((child) => {
      const matched = keep(child)
      return matched ? [matched] : []
    })
    const typeOk = !filters.type || String(node.type) === filters.type
    const statusOk = !filters.status || node.status === filters.status
    if ((typeOk && statusOk) || children.length) return { ...node, children }
    return null
  }
  return nodes.flatMap((node) => {
    const matched = keep(node)
    return matched ? [matched] : []
  })
}
