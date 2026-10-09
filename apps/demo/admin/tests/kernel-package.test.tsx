import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { createComponentResolver } from '@yishan/core-admin/components';
import { menuTreeToRoutes } from '@yishan/core-admin/menu';
import { flattenPathlessDirectories } from '@yishan/core-admin/dynamic-routes';
import type { MenuTreeNode } from '@yishan/core-admin/menu/types';

function menu(id: number, fields: Partial<MenuTreeNode>): MenuTreeNode {
  return { id, name: `menu-${id}`, type: 0, status: '1', sort_order: id, hideInMenu: false, isDefaultAction: false, isExternalLink: false, permissionCodes: [], keepAlive: false, createdAt: '', updatedAt: '', ...fields };
}

test('shared resolver renders React.lazy and keeps its identity across menu refreshes', async () => {
  const resolve = createComponentResolver({ './system/user': async () => ({ default: () => <div>shared-system-page</div> }) });
  const Page = resolve('./system/user');
  expect(Page).toBe(resolve('./system/user'));
  expect(resolve('./modules/uninstalled/page')).toBeNull();
  if (!Page) throw new Error('Expected compiled component');
  render(<Suspense fallback="loading"><Page /></Suspense>);
  expect(await screen.findByText('shared-system-page')).toBeTruthy();
});

test('nested pathless menus preserve installed pages and ignore buttons, external links and missing components', () => {
  const resolve = createComponentResolver({ './modules/catalog/list': async () => ({ default: () => null }) });
  const nodes = [menu(1, { children: [menu(2, { children: [
    menu(3, { type: 1, path: '/catalog/list', component: './modules/catalog/list' }),
    menu(4, { type: 2, path: '/button', component: './modules/catalog/list' }),
    menu(5, { type: 1, path: 'https://example.com', component: './modules/catalog/list', isExternalLink: true }),
    menu(6, { type: 1, path: '/missing', component: './modules/absent/page' }),
  ] })] })];
  const routes = flattenPathlessDirectories(menuTreeToRoutes(nodes, resolve), new Set<string>());
  expect(routes.map(route => route.path)).toEqual(['/catalog/list']);
  expect(React.isValidElement(routes[0].element)).toBe(true);
});

import { filterAvailableMenus } from '@yishan/core-admin/menu/availability';

test('installation, runtime enablement and server authorization stay separate and empty directories disappear', () => {
  const nodes = [menu(1, {children: [menu(2, {type: 1, path: '/catalog', component: './modules/catalog/list'})]}), menu(3, {type: 1, path: '/system', component: './system/user'}), menu(4, {type: 1, path: '/absent', component: './modules/absent/page'})];
  const exists = () => true;
  expect(filterAvailableMenus(nodes, ['catalog'], [], exists).map(node => node.path)).toEqual(['/system']);
  expect(filterAvailableMenus(nodes, ['catalog'], ['catalog', 'absent'], exists)).toHaveLength(2);
  expect(filterAvailableMenus(nodes, ['catalog'], ['catalog'], () => false)).toEqual([]);
  expect(filterAvailableMenus([], ['catalog'], ['catalog'], exists)).toEqual([]);
  expect(nodes[0].children).toHaveLength(1);
});
