/**
 * 管理类树形列表的纯逻辑：展平、折叠态、搜索命中。
 *
 * 菜单管理（目录/页面/按钮）和工作台管理（分组/入口）都是三层树，结构一致，
 * 只有节点字段不同，所以这里按最小公共形状工作，不依赖任何一种业务类型。
 */

/**
 * 树节点最小形状：id + 同类型的子节点。业务节点只要满足这个就能展平。
 * 递归泛型而不是 `children?: TreeNode[]`：后者会让调用方的具体类型在
 * 递归里退化成基类型，逼得每个函数都写一次不安全的强制转换。
 */
export interface TreeNode<T = unknown> {
  id: number
  children?: T[] | null
}

/** 展平后的一行：节点本身 + 层级深度 + 是否还有子节点。 */
export interface TreeRow<T> {
  node: T
  /** 顶层为 0，每深一层 +1 */
  depth: number
  hasChildren: boolean
  /** 该节点自身是否处于展开态（叶子恒为 false） */
  expanded: boolean
}

/** 节点自身是否命中关键词。 */
export type Matches<T> = (node: T, keyword: string) => boolean

/**
 * 展平树：按展开态输出可见行。
 *
 * 折叠的父节点只输出自己，不输出后代 —— 这是「折叠」的全部含义。
 */
export function flattenTree<T extends TreeNode<T>>(
  nodes: readonly T[] | null | undefined,
  expanded: ReadonlySet<number>,
  depth = 0,
): Array<TreeRow<T>> {
  const rows: Array<TreeRow<T>> = []
  for (const node of nodes ?? []) {
    const children = node.children ?? []
    const hasChildren = children.length > 0
    const isExpanded = hasChildren && expanded.has(node.id)
    rows.push({ node, depth, hasChildren, expanded: isExpanded })
    if (isExpanded) rows.push(...flattenTree(children, expanded, depth + 1))
  }
  return rows
}

/**
 * 搜索时保留：自身命中的节点，以及「有后代命中」的祖先链。
 *
 * 否则搜「编辑」时，命中的是第三层的按钮，它的目录和页面会一起消失，
 * 用户看不到自己搜到的东西挂在哪儿。
 */
export function searchTree<T extends TreeNode<T>>(
  nodes: readonly T[] | null | undefined,
  matches: Matches<T>,
  keyword: string,
): T[] {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return [...(nodes ?? [])]
  const keep: T[] = []
  for (const node of nodes ?? []) {
    if (matches(node, needle)) {
      // 自身命中时连同整棵子树保留，否则命中的父节点下面的分支会被误删。
      keep.push(node)
      continue
    }
    const children = searchTree(node.children ?? [], matches, needle)
    if (children.length) keep.push({ ...node, children })
  }
  return keep
}

/** 搜索时自动展开全部分支，否则命中的深层节点仍然藏在折叠态里。 */
export function collectExpandable<T extends TreeNode<T>>(
  nodes: readonly T[] | null | undefined,
): Set<number> {
  const ids = new Set<number>()
  const walk = (list: readonly T[] | null | undefined) => {
    for (const node of list ?? []) {
      const children = node.children ?? []
      if (children.length) {
        ids.add(node.id)
        walk(children)
      }
    }
  }
  walk(nodes)
  return ids
}

/** 在同级中切换展开态；未展开则展开，已展开则折叠。 */
export function toggleExpanded(
  expanded: ReadonlySet<number>,
  id: number,
): Set<number> {
  const next = new Set(expanded)
  if (!next.delete(id)) next.add(id)
  return next
}
