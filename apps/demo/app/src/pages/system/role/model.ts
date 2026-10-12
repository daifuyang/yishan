import Taro from '@tarojs/taro'

import * as adminRoleApi from '@/api/admin/role'
import type { AdminRole } from '@/api/admin/types'
import { getSessionVersion } from '@/api/client'
import { confirmAction } from '@/hooks'
import { canWriteModuleNow } from '@/utils/auth-guard'

/** 角色类型 */
export function roleTypeLabel(role: Pick<AdminRole, 'isSystemDefault'>): string {
  return role.isSystemDefault ? '系统角色' : '自定义角色'
}

/** 状态标签 */
export function roleStatus(role: Pick<AdminRole, 'status'>): {
  label: string
  variant: 'success' | 'default'
} {
  return role.status === '1'
    ? { label: '启用', variant: 'success' }
    : { label: '禁用', variant: 'default' }
}

/** 数据权限范围 */
export const DATA_SCOPE_LABELS: Record<AdminRole['dataScope'], string> = {
  '1': '全部数据',
  '2': '本部门数据',
  '3': '本部门及子部门',
  '4': '仅本人数据',
  '5': '自定义数据',
}

/**
 * 启用/禁用角色。
 * 写动作在 await 前后各校验一次权限与会话版本，避免权限被回收后仍然落地。
 */
export async function toggleRoleStatus(role: AdminRole): Promise<AdminRole | null> {
  const required = ['system:role:update', 'system:role:grant']
  if (!canWriteModuleNow('system-role', required)) return null
  const session = getSessionVersion()
  const next = role.status === '1' ? '0' : '1'
  const ok = await confirmAction({
    title: next === '1' ? '启用角色' : '禁用角色',
    content: `确认要${next === '1' ? '启用' : '禁用'}「${role.name}」吗？`,
    confirmText: next === '1' ? '启用' : '禁用',
    confirmColor: next === '1' ? '#1677FF' : '#F53F3F',
  })
  if (!ok) return null
  if (session !== getSessionVersion() || !canWriteModuleNow('system-role', required)) return null
  const updated = await adminRoleApi.updateAdminRole(role.id, { status: next })
  Taro.showToast({ title: '操作成功', icon: 'success' })
  return updated
}

/** 删除角色；系统内置角色禁止删除。 */
export async function removeRole(role: AdminRole): Promise<boolean> {
  if (role.isSystemDefault) {
    Taro.showToast({ title: '系统角色不可删除', icon: 'none' })
    return false
  }
  const required = ['system:role:delete']
  if (!canWriteModuleNow('system-role', required)) return false
  const session = getSessionVersion()
  const ok = await confirmAction({
    title: '删除角色',
    content: `确认删除「${role.name}」？该操作不可恢复。`,
    confirmText: '删除',
    confirmColor: '#F53F3F',
  })
  if (!ok) return false
  if (session !== getSessionVersion() || !canWriteModuleNow('system-role', required)) return false
  await adminRoleApi.deleteAdminRole(role.id)
  Taro.showToast({ title: '已删除', icon: 'success' })
  return true
}
