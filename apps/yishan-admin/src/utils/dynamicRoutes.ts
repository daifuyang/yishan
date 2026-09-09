/**
 * 递归展开后端 sys_menu 生成的动态路由树。
 *
 * `menuTreeToRoutes` 对 type=0 目录节点会返回无 path 的 `{ routes: [...] }`
 * 包装器（参见 src/utils/menuRoutes.ts 的目录约定）。当目录嵌套深度 > 1
 * 时 —— 例如 CRM → 市场管理(type=0) → 线索(/crm/leads) —— 老逻辑只平铺
 * 一层会丢失深层的 path 路由，导致 /crm/leads 落到 404。
 *
 * 本模块提供 `flattenPathlessDirectories`：沿 `routes` 字段递归下降，把
 * 所有 path-bearing 叶子按 pre-order 收集起来；遇到 path-bearing 节点即
 * 当作叶子处理（umi 会用其 element 作为该 path 的渲染入口，子路由通过
 * layout route 自动嵌套），不再继续下钻 `routes`。
 *
 * 调用方负责 dedup：helper 把命中过的 path 写入传入的 `existingPaths` Set，
 * 同一棵树内重复出现的 path 会被去重。
 */

export interface FlattenableDynamicRoute {
  path?: string
  routes?: FlattenableDynamicRoute[]
  [key: string]: unknown
}

/**
 * 接受任意带 path? / routes? 的对象数组（含 UmiRouteFromMenu 等结构兼容的
 * 路由类型）。返回与输入同构的展开列表。
 */
export function flattenPathlessDirectories<
  T extends { path?: string; routes?: readonly unknown[] },
>(
  nodes: readonly T[] | undefined,
  existingPaths: Set<unknown>,
): T[] {
  const out: T[] = []
  const visit = (list: readonly T[] | undefined): void => {
    if (!list) return
    for (const node of list) {
      if (node.path) {
        if (!existingPaths.has(node.path)) {
          out.push(node)
          existingPaths.add(node.path)
        }
        // path-bearing 节点视为叶子：不递归下钻 routes，避免拆散 umi 的
        // layout route（其 element + routes 共同构成嵌套渲染）。
        continue
      }
      if (node.routes?.length) {
        visit(node.routes as readonly T[])
      }
    }
  }
  visit(nodes)
  return out
}
