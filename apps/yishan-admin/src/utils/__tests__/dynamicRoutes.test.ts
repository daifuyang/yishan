/**
 * `flattenPathlessDirectories` 单元测试。
 *
 * 覆盖 dynamicRoutes 树里 pathless 目录节点的递归展开：
 *  1. CRM → 市场管理(type=0 无 component) → 线索(/crm/leads) 三层嵌套：
 *     线索作为叶子被展开并 push。
 *  2. path-bearing 节点视为叶子，不再下钻其 routes —— 保留 layout route
 *     嵌套语义。
 *  3. 同一棵树内重复 path 去重；与传入的 existingPaths 联合去重。
 *  4. 空树 / 全 pathless 但无 routes 的节点：不抛错，返回空数组。
 */

import {
  flattenPathlessDirectories,
  type FlattenableDynamicRoute,
} from '@/utils/dynamicRoutes'

const leaf = (path: string): FlattenableDynamicRoute => ({
  path,
  element: { tag: path },
})

describe('flattenPathlessDirectories —— 动态路由递归展开', () => {
  it('三层 pathless 目录嵌套：CRM → 市场管理 → 线索(/crm/leads) 能被展开', () => {
    // menuTreeToRoutes 对无 component 的目录节点返回 { routes: [...] }
    // 包装器，CRM 与 市场管理 都是 type=0 无 component，线索是叶子。
    const dynamicRoutes: FlattenableDynamicRoute[] = [
      {
        routes: [
          {
            routes: [leaf('/crm/leads')],
          },
        ],
      },
    ]

    const existingPaths = new Set<string>()
    const out = flattenPathlessDirectories(dynamicRoutes, existingPaths)

    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/crm/leads')
    expect(existingPaths.has('/crm/leads')).toBe(true)
  })

  it('path-bearing 节点视为叶子：不再下钻其 routes（保留 layout route）', () => {
    // CRM 有 path 且有 children —— 是 umi 的 layout route，必须整段保留，
    // 不能把 children 也平铺到 rootRoute.children，否则会破坏嵌套渲染。
    const layout: FlattenableDynamicRoute = {
      path: '/crm',
      element: { tag: 'crm-layout' },
      routes: [leaf('/crm/leads'), leaf('/crm/customers')],
    }

    const out = flattenPathlessDirectories([layout], new Set())

    expect(out).toEqual([layout])
    expect(out[0].routes).toHaveLength(2)
  })

  it('递归展开 pathless 中夹带 path-bearing：pathless → pathless → path', () => {
    // 深层 pathless 目录里出现一个有 path 的中间层（叶子级 path）。
    const dynamicRoutes: FlattenableDynamicRoute[] = [
      {
        routes: [
          {
            routes: [
              leaf('/crm/leads'),
              {
                routes: [leaf('/crm/follow-up')],
              },
            ],
          },
        ],
      },
    ]

    const out = flattenPathlessDirectories(dynamicRoutes, new Set())

    expect(out.map((r) => r.path)).toEqual(['/crm/leads', '/crm/follow-up'])
  })

  it('同一棵树内重复 path 只保留首个出现（pre-order）', () => {
    const dynamicRoutes: FlattenableDynamicRoute[] = [
      leaf('/crm/leads'),
      {
        routes: [leaf('/crm/leads'), leaf('/crm/customers')],
      },
    ]

    const out = flattenPathlessDirectories(dynamicRoutes, new Set())

    expect(out.map((r) => r.path)).toEqual(['/crm/leads', '/crm/customers'])
  })

  it('与调用方传入的 existingPaths 联合去重', () => {
    // 模拟 routes.ts 已声明 /crm/dashboard —— 不应再被 dynamicRoutes 加进 rootRoute.children。
    const dynamicRoutes: FlattenableDynamicRoute[] = [
      leaf('/crm/dashboard'),
      {
        routes: [leaf('/crm/leads')],
      },
    ]
    const existingPaths = new Set<string>(['/crm/dashboard'])

    const out = flattenPathlessDirectories(dynamicRoutes, existingPaths)

    expect(out.map((r) => r.path)).toEqual(['/crm/leads'])
    expect(existingPaths.has('/crm/leads')).toBe(true)
    expect(existingPaths.has('/crm/dashboard')).toBe(true)
  })

  it('空树与空 routes：返回空数组，不抛错', () => {
    expect(flattenPathlessDirectories(undefined, new Set())).toEqual([])
    expect(flattenPathlessDirectories([], new Set())).toEqual([])
    expect(
      flattenPathlessDirectories([{ routes: [] }], new Set()),
    ).toEqual([])
    // pathless 节点无 routes：跳过，不能再访问 children
    expect(
      flattenPathlessDirectories([{}, { routes: undefined }], new Set()),
    ).toEqual([])
  })
})
