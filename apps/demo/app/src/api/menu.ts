/**
 * 工作台菜单 API
 */
import { request } from './client'
import type { HomeAppIds, WorkbenchMenuNode } from './types'

/** 获取当前用户可见的工作台分组与应用入口（树形，已按角色授权与模块启用状态过滤） */
export function getAuthorizedMenuTree() {
  return request<WorkbenchMenuNode[]>({
    method: 'GET',
    path: '/api/v1/app/menus/authorized',
  })
}

/** 首页常用应用的排序（只含 ID，名称图标以授权菜单树为准） */
export function getHomeApps() {
  return request<HomeAppIds>({ method: 'GET', path: '/api/v1/app/menus/home' })
}

/** 整体覆盖当前用户固定的常用应用 */
export function saveHomePins(menuIds: readonly number[]) {
  return request<HomeAppIds>({
    method: 'PUT',
    path: '/api/v1/app/menus/pins',
    data: { menuIds: [...menuIds] },
  })
}

/** 记录一次打开，供首页推荐使用 */
export function reportAppUsage(menuId: number) {
  return request<{ recorded: boolean }>({
    method: 'POST',
    path: '/api/v1/app/menus/usage',
    data: { menuId },
  })
}
