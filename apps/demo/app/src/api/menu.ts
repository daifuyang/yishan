/**
 * 菜单相关 API
 */
import { request } from './client'
import type { SysMenuNode } from './types'

/** 获取当前用户已授权菜单（树形） */
export function getAuthorizedMenuTree() {
  return request<SysMenuNode[]>({
    method: 'GET',
    path: '/api/v1/app/menus/authorized',
  })
}

/** 获取当前用户已授权菜单（扁平） */
export function getAuthorizedMenuFlat() {
  return request<SysMenuNode[]>({
    method: 'GET',
    path: '/api/v1/app/menus/flatten',
  })
}
