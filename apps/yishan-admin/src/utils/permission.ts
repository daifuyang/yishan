/**
 * 按钮级权限工具。
 *
 * 设计原则：
 * 1. 优先读 `currentUser.permissions: string[]`（后端 /me 返回的权限码列表）。
 *    这是按钮级权限的权威来源 —— 颗粒度比菜单粒度细。
 * 2. 当 `permissions` 字段缺失（后端暂未发送，旧版本兼容）时，回退为"全通过"，
 *    不去基于菜单路径硬猜。避免误把所有按钮隐藏掉导致页面空。
 * 3. `super_admin` 直接放行 —— 这是项目既定的硬规则，README 里写明。
 * 4. 不渲染 = 无权限；不通过 disabled 控件假装权限生效。后端 401/403 兜底。
 *
 * 用法：
 *   const can = usePermission()
 *   {can('crm:customer:delete') && <a onClick={...}>删除</a>}
 *
 *   或者用 <PermissionButton code="..." /> 组件包 antd Button。
 */

import { useModel } from '@umijs/max'

/** 项目里约定的硬规则角色编码。 */
const SUPER_ADMIN_ROLE = 'super_admin'

/**
 * 检查一个权限码是否在用户的权限集合内。
 * 不读 model —— 用于 store / 工具函数等无 hook context 的场景。
 */
export function checkPermission(permissions: string[] | undefined, code: string): boolean {
  if (!permissions) return true
  return permissions.includes(code)
}

/**
 * 读 currentUser 的 permissions 数组。
 * 这里做一次简单的 memoize-by-cache：useModel 会自动缓存同一份 initialState。
 */
export function useCurrentPermissions(): string[] | undefined {
  const { initialState } = useModel('@@initialState')
  const perms = (initialState?.currentUser as { permissions?: string[] } | undefined)?.permissions
  return Array.isArray(perms) ? perms : undefined
}

/**
 * 是否为超管。超管直接放行。
 */
export function useIsSuperAdmin(): boolean {
  const { initialState } = useModel('@@initialState')
  const roleCodes = initialState?.currentUser?.roleCodes ?? []
  return roleCodes.includes(SUPER_ADMIN_ROLE)
}

/**
 * 业务页面最常用的入口。
 *   const can = usePermission()
 *   {can('crm:customer:delete') && <Button danger>...</Button>}
 */
export function usePermission(): (code: string) => boolean {
  const perms = useCurrentPermissions()
  const isSuper = useIsSuperAdmin()
  return (code: string) => {
    if (isSuper) return true
    return checkPermission(perms, code)
  }
}

/**
 * 同时校验多个权限码（AND 语义）。
 *   const canManage = useHasAllPermissions(['crm:customer:update', 'crm:customer:transfer'])
 */
export function useHasAllPermissions(codes: string[]): boolean {
  const can = usePermission()
  return codes.every((c) => can(c))
}

/**
 * 同时校验多个权限码（OR 语义）。
 *   const canManage = useHasAnyPermission(['crm:customer:update', 'crm:customer:transfer'])
 */
export function useHasAnyPermission(codes: string[]): boolean {
  const can = usePermission()
  return codes.some((c) => can(c))
}
