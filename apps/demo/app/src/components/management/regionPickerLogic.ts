/**
 * 省 / 市 / 区级联选择的纯逻辑，供 RegionPicker 与单测共用。
 * 不依赖任何产品 API：节点结构只要求 code / name，children 可选。
 */
export interface RegionNode {
  code: number | string
  name: string
  level?: number
  children?: RegionNode[]
}

export type RegionPickerMode = 'lazy' | 'tree'

export const REGION_LEVEL_LABELS = ['省份', '城市', '区县'] as const
export const REGION_MAX_DEPTH = REGION_LEVEL_LABELS.length
export const REGION_PENDING_LABEL = '请选择'

export const sameRegion = (a?: RegionNode, b?: RegionNode) =>
  Boolean(a && b && String(a.code) === String(b.code))

export interface RegionTab {
  /** 层级下标：0 省份，1 城市，2 区县 */
  depth: number
  label: string
  pending: boolean
}

/**
 * 顶部页签：每个已选层级显示所选名称；路径未完成时末尾追加「请选择」页签。
 * complete 表示当前路径已经落到末级（确认过的值或已知叶子），不再需要下一级。
 */
export function regionTabs(
  path: readonly RegionNode[],
  complete: boolean,
  maxDepth = REGION_MAX_DEPTH,
): RegionTab[] {
  const tabs: RegionTab[] = path
    .slice(0, maxDepth)
    .map((node, depth) => ({ depth, label: node.name, pending: false }))
  if (!complete && path.length < maxDepth)
    tabs.push({ depth: path.length, label: REGION_PENDING_LABEL, pending: true })
  return tabs
}

/**
 * 选中节点是否就是末级：到达最大层级，或已知没有下级。
 * 整树模式下 children 缺省即视为叶子；按需模式下 children 缺省表示「未知，需要再查一次」。
 */
export function isRegionLeaf(
  node: RegionNode,
  depth: number,
  mode: RegionPickerMode,
  maxDepth = REGION_MAX_DEPTH,
): boolean {
  if (depth + 1 >= maxDepth) return true
  if (mode === 'tree') return !node.children?.length
  return Array.isArray(node.children) && node.children.length === 0
}

/** 在 depth 层选中 node：截断其后的旧选择。 */
export function selectRegion<T extends RegionNode>(path: readonly T[], depth: number, node: T): T[] {
  return [...path.slice(0, depth), node]
}

/** 整树模式下取 depth 层的候选项：沿已选路径逐级下钻。 */
export function regionOptionsInTree<T extends RegionNode>(
  roots: readonly T[],
  path: readonly RegionNode[],
  depth: number,
): T[] {
  let level: readonly T[] = roots
  for (let index = 0; index < depth; index++) {
    const found = level.find((node) => sameRegion(node, path[index]))
    level = (found?.children as T[] | undefined) ?? []
  }
  return [...level]
}

/** 按需模式缓存键：depth 层候选项由上一层所选节点决定。 */
export function regionParentKey(path: readonly RegionNode[], depth: number): string {
  return depth === 0 ? '' : String(path[depth - 1]?.code ?? '')
}

/** 选择结果摘要：名称以「 / 」连接。 */
export function formatRegionPath(path: readonly RegionNode[]): string {
  return path.map((node) => node.name).join(' / ')
}
