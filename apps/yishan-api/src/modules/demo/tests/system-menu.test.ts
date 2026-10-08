import { describe, expect, it } from 'vitest'
import {
  flattenMenuTree,
  toBool,
  type AdminMenuNode,
} from '../seed.js'
import systemMenu from '../config/system-menu.json'

const REGION_PAGE = '/demo/region'

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
    // demo JSON 共 1 顶级 + 4 页面 + 7 按钮 = 12
    // (quickstart 1 + health 1 + todos 4 + region 1)
    expect(flat.length).toBe(12)
  })

  it('深度按层级递增：顶级 depth=0，页面 depth=1，按钮 depth=2', () => {
    const flat = flattenMenuTree(tree)
    const depths = flat.map((f) => f.depth)
    expect(depths.filter((d) => d === 0).length).toBe(1)
    expect(depths.filter((d) => d === 1).length).toBe(4)
    expect(depths.filter((d) => d === 2).length).toBe(7)
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
    // demo JSON 里每个按钮节点都带 permissionCodes
    expect(withCodes.length).toBe(7)
    for (const f of withCodes) {
      const expected = f.parentPath === REGION_PAGE ? /^region:/ : /^demo:/
      for (const code of f.node.permissionCodes!) expect(code).toMatch(expected)
    }
  })

  it('hideInMenu / isDefaultAction 的 0/1 字段被原样保留', () => {
    const flat = flattenMenuTree(tree)
    const buttons = flat.filter((f) => f.node.type === 2)
    // 所有按钮都标了 hideInMenu=1
    expect(buttons.every((b) => b.node.hideInMenu === 1)).toBe(true)
    // isDefaultAction 只在「查看」按钮上为 1
    const defaultActions = buttons.filter((b) => b.node.isDefaultAction === 1)
    expect(defaultActions.length).toBe(4) // 4 个查看按钮
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

  it('按钮都带 permissionCodes，且形如 demo:<area>:<action>', () => {
    for (const b of buttons.filter((b) => b.parentPath !== REGION_PAGE)) {
      expect(b.node.permissionCodes).toBeDefined()
      expect(b.node.permissionCodes!.length).toBe(1)
      expect(b.node.permissionCodes![0]).toMatch(/^demo:[a-z]+:[a-z]+$/)
    }
  })

  // 省市级联示例页演示的是 Core 的地区接口，因此按钮绑定 Core 的 region:* 权限而非 demo:*。
  it('省市级联页的查看按钮绑定 Core 地区权限', () => {
    const regionButtons = buttons.filter((b) => b.parentPath === REGION_PAGE)
    expect(regionButtons).toHaveLength(1)
    expect(regionButtons[0].node.permissionCodes).toEqual(['region:list', 'region:tree', 'region:path', 'region:read'])
  })
})