/**
 * 把后端授权菜单树转换为 umi 运行时路由。
 *
 * `sys_menu` 是菜单的单一真相源；每个非目录/非外链菜单的 `component`
 * 字段已经存了虚拟路径（相对 src/pages，如 `./system/user` 或
 * `./modules/demo/documents`）。这里通过 `moduleComponents.resolve`
 * 把虚拟路径转成真实的 React.lazy 元素，再交给 umi 的 patchClientRoutes。
 *
 * 行为约定：
 *   - 按钮节点（type=2）不生成 Route
 *   - 外链节点（isExternalLink=true）不生成 Route（菜单里仍可保留入口，
 *     由 ProLayout 处理 window.open 或单独组件渲染）
 *   - 目录节点（type=0）没有 component：只把 children 透传上去
 *   - 叶子菜单（type=1）：path / element / name
 *   - 缺失 component：跳过节点，dev 模式下控制台已有 resolver 提示
 *
 * 关于路由层 access：后端 /menus 接口已经按 role 过滤，后端 API 还有
 * 模块级 gate 与 perms preHandler。前端路由层不再做白名单，避免
 * `useAccessMarkedRoutes` 误标 `unaccessible` 导致菜单可见但页面不渲染。
 * 未授权 URL 直接交给 `*` 路由（全局 404）。
 */

import React from 'react'
import type { MenuTreeList, MenuTreeNode } from '@/types/sdk'
import { resolve as resolveComponent } from '@/utils/moduleComponents'

export interface UmiRouteFromMenu {
  id?: string
  path?: string
  name?: string
  element?: React.ReactNode
  routes?: UmiRouteFromMenu[]
}

export function menuTreeToRoutes(nodes: MenuTreeList = []): UmiRouteFromMenu[] {
  const visit = (n: MenuTreeNode): UmiRouteFromMenu | null => {
    if (n.type === 2) return null
    if (n.isExternalLink) return null

    const childRoutes = (n.children ?? [])
      .map(visit)
      .filter((r): r is UmiRouteFromMenu => r !== null)

    // 目录或 component 缺失：只透传 children，不生成自身 Route
    if (!n.component) {
      return childRoutes.length > 0 ? { routes: childRoutes } : null
    }

    const element = resolveComponent(n.component)
    // resolver 未命中：跳过该节点，URL 落到全局 404
    if (!element) return null

    const route: UmiRouteFromMenu = {
      id: n.path ?? undefined,
      path: n.path,
      name: n.name,
      // 用 React.createElement 把 lazy component 显式包成 ReactElement，
      // 避免 umi 4 + React 19 在 patchClientRoutes 阶段把 lazy 函数当 Route children 渲染。
      element: React.createElement(element) as unknown as React.ReactNode,
    }
    if (childRoutes.length > 0) route.routes = childRoutes
    return route
  }

  return nodes
    .map(visit)
    .filter((r): r is UmiRouteFromMenu => r !== null)
}

