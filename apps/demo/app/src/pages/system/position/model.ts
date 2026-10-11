import { deleteAdminPosition, type SaveAdminPosition } from '@/api/admin/position'
import { getSessionVersion } from '@/api/client'
import { confirmAction } from '@/hooks'
import { canWriteModuleNow } from '@/utils/auth-guard'

export const POSITION_STATUSES = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

export function positionPayload(
  name: string,
  description: string,
  status: '0' | '1',
  sort: string,
): SaveAdminPosition {
  if (!name.trim()) throw new Error('请输入岗位名称')
  if (!sort.trim() || !Number.isFinite(Number(sort)) || Number(sort) < 0)
    throw new Error('排序须为非负数字')
  return { name: name.trim(), description, status, sort_order: Number(sort) }
}

export async function removePosition(
  position: { id: number; name: string },
  active: () => boolean = () => true,
): Promise<boolean> {
  const required = ['system:position:delete']
  const session = getSessionVersion()
  const current = () =>
    active() && session === getSessionVersion() && canWriteModuleNow('system-position', required)
  if (!current()) return false
  if (
    !(await confirmAction({
      content: `确定删除岗位“${position.name}”？`,
      confirmColor: '#F53F3F',
    })) ||
    !current()
  )
    return false
  await deleteAdminPosition(position.id)
  return current()
}
