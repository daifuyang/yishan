import {
  deleteAdminAppMenu,
  type AdminAppMenu,
  type SaveAdminAppMenu,
} from '@/api/admin/appMenu'
import { getSessionVersion } from '@/api/client'
import { confirmAction } from '@/hooks'
import { canWriteModuleNow } from '@/utils/auth-guard'

export interface AppMenuFormValues {
  name: string
  type: AdminAppMenu['type']
  parentId?: number
  icon: string
  page: string
  /** 表单里不暴露所属模块，但必须原样带回，否则一次改名就把归属改掉了 */
  moduleId: string
  status: '0' | '1'
  sort: string
}

export function appMenuDraft(parentId?: number): AppMenuFormValues {
  return {
    name: '',
    type: parentId ? 1 : 0,
    parentId,
    icon: '',
    page: '',
    moduleId: 'core',
    status: '1',
    sort: '',
  }
}

/** 只有分组能容纳入口；入口必须挂在某个分组下。 */
export function appMenuGroupOptions(
  tree: readonly AdminAppMenu[],
  selfId?: number,
): { value: string; label: string }[] {
  return tree
    .filter((node) => node.type === 0 && node.id !== selfId)
    .map((node) => ({ value: String(node.id), label: node.name }))
}

export function isAppMenuGroup(node: AdminAppMenu): boolean {
  return node.type === 0
}

export function appMenuPayload(
  values: AppMenuFormValues,
  groups: readonly AdminAppMenu[] = [],
): SaveAdminAppMenu {
  const name = values.name.trim()
  if (!name) throw new Error('请输入名称')
  const isGroup = values.type === 0
  if (
    !isGroup &&
    (!values.parentId || !groups.some((group) => group.id === values.parentId && isAppMenuGroup(group)))
  )
    throw new Error('请选择所属分组')
  const page = values.page.trim()
  if (!isGroup && !/^pages\/[\w\-/]+$/.test(page))
    throw new Error('请填写有效页面路径，如 pages/system/user/index')
  // 排序留空表示排在末尾，而不是 0 —— 0 会把它顶到最前面
  const sort = values.sort.trim()
  if (sort && (!Number.isInteger(Number(sort)) || Number(sort) < 0))
    throw new Error('排序须为非负整数')
  return {
    name,
    type: values.type,
    parentId: isGroup ? undefined : values.parentId,
    icon: values.icon.trim(),
    page: isGroup ? undefined : page,
    moduleId: values.moduleId?.trim() || 'core',
    sortOrder: sort ? Number(sort) : undefined,
    status: values.status,
  }
}

export async function removeAppMenu(
  menu: { id: number; name: string },
  active: () => boolean = () => true,
): Promise<boolean> {
  const required = ['system:app-menu:delete']
  const session = getSessionVersion()
  const current = () =>
    active() && session === getSessionVersion() && canWriteModuleNow('system-app-menu', required)
  if (!current()) return false
  if (
    !(await confirmAction({
      content: `确定删除工作台菜单“${menu.name}”？`,
      confirmColor: '#F53F3F',
    })) ||
    !current()
  )
    return false
  await deleteAdminAppMenu(menu.id)
  return current()
}
