/**
 * 把后端授权菜单树转换为 umi 运行时路由。
 *
 * `sys_menu` 是菜单的单一真相源；每个非目录/非外链菜单的 `component`
 * 字段已经存了 umi 约定的相对路径（相对 src/pages，如 `./system/user`），
 * 这里把它直接喂给 umi 的 patchClientRoutes 即可。
 *
 * 行为约定：
 *   - 按钮节点（type=2）不生成 Route
 *   - 外链节点（isExternalLink=true）不生成 Route（菜单里仍可保留入口，
 *     由 ProLayout 处理 window.open 或单独组件渲染）
 *   - 目录节点（type=0）没有 component：只把 children 透传上去
 *   - 叶子菜单（type=1）：path / component / name / access: 'canDo'
 */

import type { MenuTreeList, MenuTreeNode } from '@/types/sdk';

export interface UmiRouteFromMenu {
  path?: string;
  component?: string;
  name?: string;
  access?: 'canDo';
  routes?: UmiRouteFromMenu[];
}

export function menuTreeToRoutes(nodes: MenuTreeList = []): UmiRouteFromMenu[] {
  const visit = (n: MenuTreeNode): UmiRouteFromMenu | null => {
    if (n.type === 2) return null;
    if (n.isExternalLink) return null;

    const childRoutes = (n.children ?? [])
      .map(visit)
      .filter((r): r is UmiRouteFromMenu => r !== null);

    // 目录或 component 缺失：只透传 children，不生成自身 Route
    if (!n.component) {
      return childRoutes.length > 0 ? { routes: childRoutes } : null;
    }

    const route: UmiRouteFromMenu = {
      path: n.path,
      component: n.component,
      name: n.name,
      access: 'canDo',
    };
    if (childRoutes.length > 0) route.routes = childRoutes;
    return route;
  };

  return nodes
    .map(visit)
    .filter((r): r is UmiRouteFromMenu => r !== null);
}