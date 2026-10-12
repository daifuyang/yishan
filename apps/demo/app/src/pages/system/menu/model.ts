import { deleteAdminMenu, type AdminMenu, type SaveAdminMenu } from '@/api/admin/menu'
import { getSessionVersion } from '@/api/client'
import { confirmAction } from '@/hooks'
import { canWriteModuleNow } from '@/utils/auth-guard'

export interface MenuFormValues {
  name: string
  type: AdminMenu['type']
  parentId?: number
  path: string
  icon: string
  component: string
  status: '0' | '1'
  sort: string
  hideInMenu: boolean
  isDefaultAction: boolean
  isExternalLink: boolean
  keepAlive: boolean
  permissionCodes: string[]
}

export function menuDraft(parentId?: number): MenuFormValues {
  return {
    name: '',
    type: 1,
    parentId,
    path: '',
    icon: '',
    component: '',
    status: '1',
    sort: '0',
    hideInMenu: false,
    isDefaultAction: false,
    isExternalLink: false,
    keepAlive: false,
    permissionCodes: [],
  }
}

/**
 * 校验并组装保存载荷。
 *
 * 组件路径只在「非目录且非外链」时必填：目录不需要渲染页面，外链由 path 承担。
 * 关联功能仅对非目录有意义，目录传空数组而不是留着旧值。
 */
export function menuPayload(values: MenuFormValues): SaveAdminMenu {
  const name = values.name.trim()
  if (!name) throw new Error('请输入菜单名称')
  const sort = Number(values.sort)
  if (!values.sort.trim() || !Number.isFinite(sort) || sort < 0)
    throw new Error('排序须为非负数字')
  const isDirectory = values.type === 0
  const component = values.component.trim()
  if (!isDirectory && !values.isExternalLink && !/^\.{1,2}\/[\w\-./]+$/.test(component))
    throw new Error('请填写有效组件路径，如 ./system/menu')
  return {
    name,
    type: values.type,
    parentId: values.parentId,
    path: values.path.trim(),
    icon: values.icon.trim(),
    component: isDirectory ? '' : component,
    status: values.status,
    sort_order: sort,
    hideInMenu: values.hideInMenu,
    // 目录没有「页面默认访问操作」的概念，强行带上去会存成脏数据。
    // 页面/按钮则原样带回：这个字段不在表单里暴露，改名不能顺手抹掉它。
    isDefaultAction: isDirectory ? false : values.isDefaultAction,
    isExternalLink: values.isExternalLink,
    keepAlive: values.keepAlive,
    // 刻意不带 permissionCodes：关联功能由独立页负责。
    // 后端只在字段 !== undefined 时才替换关联，编辑页带着旧值提交会覆盖
    // 用户刚在关联功能页保存的结果 —— 表现为「刚勾的权限又变回去了」。
  }
}

export async function removeMenu(
  menu: { id: number; name: string },
  active: () => boolean = () => true,
): Promise<boolean> {
  const required = ['system:menu:delete']
  const session = getSessionVersion()
  const current = () =>
    active() && session === getSessionVersion() && canWriteModuleNow('system-menu', required)
  if (!current()) return false
  if (
    !(await confirmAction({
      content: `确定删除菜单“${menu.name}”？`,
      confirmColor: '#F53F3F',
    })) ||
    !current()
  )
    return false
  await deleteAdminMenu(menu.id)
  return current()
}
