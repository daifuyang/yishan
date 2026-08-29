import { describe, expect, it } from 'vitest'
import {
  flattenMenuTree,
  toBool,
  type AdminMenuNode,
} from '../seed.js'
import systemMenu from '../config/system-menu.json'

/**
 * 验证 seed 入口从 ./config/system-menu.json 解析菜单树的核心行为。
 * 这里只测纯函数部分（flattenMenuTree / toBool / JSON 字段保留）；
 * 真 DB 写入由 seedDemo() 跑 pnpm db:seed 时覆盖，不进单元测试。
 */
describe('system-menu.json', () => {
  it('顶层是数组', () => {
    expect(Array.isArray(systemMenu)).toBe(true)
    expect(systemMenu.length).toBeGreaterThan(0)
  })

  it('第一个节点是 demo 模块的顶级目录', () => {
    const root = (systemMenu as AdminMenuNode[])[0]
    expect(root.type).toBe(0) // 目录
    expect(root.name).toBeTruthy()
  })
})

describe('flattenMenuTree', () => {
  const tree = systemMenu as AdminMenuNode[]

  it('铺平后节点总数 === 顶级 + 所有后代', () => {
    const flat = flattenMenuTree(tree)
    // 不变量：根节点 1 个；其余节点数等于 JSON 全部元素的非根数；
    // 用"大于等于"而非硬编码具体值，避开"加一个演示页面"的快照失效。
    // 现状：1 顶级 + 4 页面（quickstart/health/todos/region）+ 4 按钮 = 9
    expect(flat.length).toBeGreaterThanOrEqual(1 + 3 + 6)
  })

  it('深度按层级递增：顶级 depth=0，页面 depth=1，按钮 depth=2', () => {
    const flat = flattenMenuTree(tree)
    const depths = flat.map((f) => f.depth)
    // 1 个顶级目录；至少 3 个页面；至少 6 个按钮（demo 演示模块的最低保证）
    expect(depths.filter((d) => d === 0).length).toBe(1)
    expect(depths.filter((d) => d === 1).length).toBeGreaterThanOrEqual(3)
    expect(depths.filter((d) => d === 2).length).toBeGreaterThanOrEqual(6)
  })

  it('铺平顺序与 JSON 出现顺序一致（深度优先）', () => {
    const flat = flattenMenuTree(tree)
    const firstPath = flat[0].node.path
    expect(firstPath).toBe((tree[0] as AdminMenuNode).path)
  })

  it('无限级嵌套：5 层 children 也能正确展开', () => {
    const deep: AdminMenuNode = {
      type: 0,
      name: 'l0',
      path: '/p/l0',
      sortOrder: 1,
      children: [
        {
          type: 1,
          name: 'l1',
          path: '/p/l1',
          sortOrder: 1,
          children: [
            {
              type: 2,
              name: 'l2',
              path: '/p/l2',
              sortOrder: 1,
              children: [
                {
                  type: 2,
                  name: 'l3',
                  path: '/p/l3',
                  sortOrder: 1,
                  children: [
                    {
                      type: 2,
                      name: 'l4',
                      path: '/p/l4',
                      sortOrder: 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const flat = flattenMenuTree([deep])
    expect(flat.map((f) => f.node.path)).toEqual(['/p/l0', '/p/l1', '/p/l2', '/p/l3', '/p/l4'])
    expect(flat.map((f) => f.depth)).toEqual([0, 1, 2, 3, 4])
  })

  it('空数组 → 空铺平', () => {
    expect(flattenMenuTree([])).toEqual([])
  })

  it('children 为空数组时按叶子处理（不进入下一层）', () => {
    const node: AdminMenuNode = {
      type: 1,
      name: 'leaf',
      path: '/leaf',
      sortOrder: 1,
      children: [],
    }
    const flat = flattenMenuTree([node])
    expect(flat).toEqual([{ node, depth: 0, parentPath: null }])
  })

  it('permissionCodes 字段在铺平后仍可访问', () => {
    const flat = flattenMenuTree(tree)
    const withCodes = flat.filter((f) => f.node.permissionCodes && f.node.permissionCodes.length > 0)
    // 不变量：每个按钮节点都至少带一个权限码；
    // 码形如 `<namespace>:<area>[:<action>]`，namespace 可以是 demo/region 等
    // （region 那个页面绑了 4 个权限码：list/tree/path/read）。
    expect(withCodes.length).toBeGreaterThanOrEqual(6)
    for (const f of withCodes) {
      for (const code of f.node.permissionCodes!) {
        expect(code).toMatch(/^[a-z]+:[a-z]+(?::[a-z]+)?$/)
      }
    }
  })

  it('hideInMenu / isDefaultAction 的 0/1 字段被原样保留', () => {
    const flat = flattenMenuTree(tree)
    const buttons = flat.filter((f) => f.node.type === 2)
    // 所有按钮都标了 hideInMenu=1
    expect(buttons.every((b) => b.node.hideInMenu === 1)).toBe(true)
    // 每个有 path 的页面至少配 1 个默认动作（"查看"按钮 isDefaultAction=1）
    // —— 这是 UI 约定：列表/详情页总要有一个默认入口；不强制"恰好 3 个"
    const defaultActions = buttons.filter((b) => b.node.isDefaultAction === 1)
    expect(defaultActions.length).toBeGreaterThanOrEqual(1)
  })
})

describe('toBool', () => {
  it('0 → false', () => {
    expect(toBool(0)).toBe(false)
  })
  it('1 → true', () => {
    expect(toBool(1)).toBe(true)
  })
  it('undefined → false（缺省视为未设置）', () => {
    expect(toBool(undefined)).toBe(false)
  })
})

/**
 * 真实 DB 跑过的语义约束：按钮节点（type=2）不应有 path，
 * seed 的"无 path"分支应走"绑定到最近的有 path 的祖先"逻辑。
 * 这里直接验证 system-menu.json 里按钮确实没 path，
 * 且所有按钮的 permissionCodes 在铺平后仍可被收集。
 */
describe('按钮节点（type=2）', () => {
  const tree = systemMenu as AdminMenuNode[]
  const flat = flattenMenuTree(tree)
  const buttons = flat.filter((f) => f.node.type === 2)

  it('至少存在 6 个按钮节点', () => {
    expect(buttons.length).toBeGreaterThanOrEqual(6)
  })

  it('按钮节点没有 path 字段（与系统约定一致）', () => {
    expect(buttons.every((b) => !b.node.path)).toBe(true)
  })

  it('按钮节点都挂在某个有 path 的页面下（depth=2）', () => {
    expect(buttons.every((b) => b.depth === 2)).toBe(true)
    for (const b of buttons) {
      expect(b.parentPath).toBeTruthy()
    }
  })

  it('按钮都带 permissionCodes，且形如 <ns>:<area>[:<action>]', () => {
    // 按钮可以绑 1 个或多个权限码：todos 演示页面 1 个，region 页面 4 个（list/tree/path/read）。
    // 不变量只是"权限码至少 1 个 + 形如合法命名空间"，
    // 不要再硬编码 `=== 1` —— 那是数据快照，不是逻辑契约。
    for (const b of buttons) {
      expect(b.node.permissionCodes).toBeDefined()
      expect(b.node.permissionCodes!.length).toBeGreaterThanOrEqual(1)
      for (const code of b.node.permissionCodes!) {
        expect(code).toMatch(/^[a-z]+:[a-z]+(?::[a-z]+)?$/)
      }
    }
  })
})