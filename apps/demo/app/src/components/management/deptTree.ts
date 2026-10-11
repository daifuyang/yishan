import type { AdminDept } from '@/api/admin/types'

export interface DeptPathNode {
  id: number
  name: string
}

export interface DeptFlatNode {
  node: AdminDept
  path: DeptPathNode[]
}

// AdminDept.children 的类型是 AdminDept[] | null；所有遍历都经此归一，
// 避免把 null 当数组而抛错。
function kids(node: AdminDept | null | undefined): AdminDept[] {
  return node?.children ?? []
}

export function hasChildren(node: AdminDept): boolean {
  return kids(node).length > 0
}

/** 取某节点的直接子节点。parentId 为 null 表示根层。 */
export function childOf(nodes: AdminDept[] | null | undefined, parentId: number | null): AdminDept[] {
  if (!parentId) return nodes ?? []
  return kids((nodes ?? []).find((node) => node.id === parentId))
}

/** 深度优先查找从根到 id 的路径。找不到返回空数组。 */
export function findDeptPath(tree: AdminDept[] | null | undefined, id: number): DeptPathNode[] {
  const walk = (nodes: AdminDept[], trail: DeptPathNode[]): DeptPathNode[] | null => {
    for (const node of nodes) {
      const next = [...trail, { id: node.id, name: node.name }]
      if (node.id === id) return next
      const found = walk(kids(node), next)
      if (found) return found
    }
    return null
  }
  return walk(tree ?? [], []) ?? []
}

/** 深度优先展平整棵树，每项带完整路径。 */
export function flattenDepts(tree: AdminDept[] | null | undefined): DeptFlatNode[] {
  const out: DeptFlatNode[] = []
  const walk = (nodes: AdminDept[], trail: DeptPathNode[]) => {
    for (const node of nodes) {
      const next = [...trail, { id: node.id, name: node.name }]
      out.push({ node, path: next })
      walk(kids(node), next)
    }
  }
  walk(tree ?? [], [])
  return out
}

/** 按名称子串搜索，保留命中节点的完整路径。关键词为空返回空数组。 */
export function searchDepts(tree: AdminDept[] | null | undefined, keyword: string): DeptFlatNode[] {
  const kw = keyword.trim()
  if (!kw) return []
  return flattenDepts(tree).filter((item) => item.node.name.includes(kw))
}