/**
 * 菜单 path → Taro 页面 路由映射
 * 匹配规则（按优先级）：menu.path → menu.perm → menu.name
 * 命中后返回 { type: 'page' | 'tab', url }
 * 未命中或 isExternalLink=true → 返回 { type: 'none' }，由调用方决定兜底
 */
import type { SysMenuNode } from '@/api/types'

import { SECONDARY_PAGES, SYSTEM_PAGES, TAB_PAGES } from './routes'

export type ResolvedRoute =
  | { type: 'page'; url: string }
  | { type: 'tab'; url: string }
  | { type: 'none' }

type RouteMap = Record<string, string>

/**
 * 后端菜单字段 → Taro 页面
 *  - key 用后端实际下发的 path / perm / name（小写、去前导斜杠）
 *  - value 是 Taro 页面相对路径
 */
const PAGE_MAP: RouteMap = {
  // 系统管理（PR-1 起的 4 项）
  '/system/user': SYSTEM_PAGES.userIndex,
  '/system/login-log': SYSTEM_PAGES.loginLog,
  '/system/dept': SYSTEM_PAGES.deptIndex,
  '/system/dict': SYSTEM_PAGES.dictIndex,
  '用户管理': SYSTEM_PAGES.userIndex,
  '登录日志': SYSTEM_PAGES.loginLog,
  '部门管理': SYSTEM_PAGES.deptIndex,
  '字典管理': SYSTEM_PAGES.dictIndex,
  // 已有二级页
  'contacts': SECONDARY_PAGES.contactsIndex,
  '/contacts': SECONDARY_PAGES.contactsIndex,
  '通讯录': SECONDARY_PAGES.contactsIndex,
  '个人资料': SECONDARY_PAGES.profileEdit,
  '修改密码': SECONDARY_PAGES.profilePassword,
  '登录日志(我的)': SECONDARY_PAGES.profileLoginLog,
}

const TAB_MAP: RouteMap = {
  '/index': TAB_PAGES.home,
  '/apps': TAB_PAGES.apps,
  '/mine': TAB_PAGES.mine,
  '首页': TAB_PAGES.home,
  '功能': TAB_PAGES.apps,
  '我的': TAB_PAGES.mine,
}

function lookupIn(map: RouteMap, keys: string[]): string | undefined {
  for (const k of keys) {
    if (!k) continue
    const normalized = k.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
    if (normalized && map[normalized]) return map[normalized]
    if (map[k]) return map[k]
    if (map[k.toLowerCase()]) return map[k.toLowerCase()]
  }
  return undefined
}

export function resolveMenuRoute(menu: SysMenuNode): ResolvedRoute {
  if (menu.isExternalLink) return { type: 'none' }

  const keys: string[] = [menu.path, menu.perm, menu.name].filter(
    (k): k is string => typeof k === 'string' && k.length > 0,
  )
  const tabHit = lookupIn(TAB_MAP, keys)
  if (tabHit) return { type: 'tab', url: `/${tabHit}` }
  const pageHit = lookupIn(PAGE_MAP, keys)
  if (pageHit) return { type: 'page', url: `/${pageHit}` }
  return { type: 'none' }
}
