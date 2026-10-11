/**
 * 工作台菜单 API
 */
import { request } from './client'
import type { WorkbenchMenuNode } from './types'

/** 获取当前用户可见的工作台分组与应用入口（树形，已按角色授权与模块启用状态过滤） */
export function getAuthorizedMenuTree() {
  return request<WorkbenchMenuNode[]>({
    method: 'GET',
    path: '/api/v1/app/menus/authorized',
  })
}
