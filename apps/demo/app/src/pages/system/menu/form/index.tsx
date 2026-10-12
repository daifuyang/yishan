import {
  createAdminMenu,
  getAdminMenu,
  getAdminMenuTree,
  updateAdminMenu,
} from '@/api/admin/menu'
import {
  EnumField,
  FormField,
  FormSection,
  LinkRow,
  SwitchField,
  TextField,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '../../_shared/AdminUI'
import { MenuFormScaffold, useMenuForm } from '../../_shared/MenuFormScaffold'
import { MENU_TYPE_LABELS } from '../filters'
import { menuDraft, menuPayload, type MenuFormValues } from '../model'
import { menuParentOptions } from '../parents'

// 类型文案与列表、详情一致：都来自 MenuTypeBadge，不再各写一套「按钮/操作」
const TYPE_OPTIONS = [
  { value: '1' as const, label: MENU_TYPE_LABELS[1] },
  { value: '0' as const, label: MENU_TYPE_LABELS[0] },
  { value: '2' as const, label: MENU_TYPE_LABELS[2] },
]

function MenuFormPage() {
  const form = useMenuForm({
    noun: '菜单',
    moduleId: 'system-menu',
    permission: 'system:menu',
    draft: menuDraft,
    fetch: getAdminMenu,
    toValues: (menu): MenuFormValues => ({
      name: menu.name,
      type: menu.type,
      parentId: menu.parentId,
      path: menu.path || '',
      icon: menu.icon || '',
      component: menu.component || '',
      status: menu.status,
      sort: String(menu.sort_order),
      hideInMenu: Boolean(menu.hideInMenu),
      isDefaultAction: Boolean(menu.isDefaultAction),
      isExternalLink: Boolean(menu.isExternalLink),
      keepAlive: Boolean(menu.keepAlive),
      permissionCodes: menu.permissionCodes || [],
    }),
    fetchTree: getAdminMenuTree,
    payload: (values) => menuPayload(values),
    create: createAdminMenu,
    update: updateAdminMenu,
  })
  const { values, set, disabled, id } = form
  const isDirectory = values.type === 0
  const parentOptions = menuParentOptions(form.tree, id)

  return (
    <MenuFormScaffold form={form}>
      <FormSection title="基础信息">
        <EnumField
          label="菜单类型"
          value={String(values.type)}
          options={TYPE_OPTIONS}
          disabled={disabled}
          onChange={(value) => set({ type: Number(value) as MenuFormValues['type'] })}
        />
        <FormField label="菜单名称" required>
          <TextField
            value={values.name}
            onChange={(name) => set({ name })}
            placeholder="请输入菜单名称"
            maxlength={100}
            disabled={disabled}
          />
        </FormField>
        <EnumField
          label="上级菜单"
          value={values.parentId == null ? '' : String(values.parentId)}
          options={
            values.parentId == null && !id
              ? [{ value: '', label: '顶级菜单' }, ...parentOptions]
              : parentOptions
          }
          disabled={disabled}
          onChange={(value) => set({ parentId: value ? Number(value) : undefined })}
        />
        <FormField label="图标">
          <TextField
            value={values.icon}
            onChange={(icon) => set({ icon })}
            placeholder="如 UserOutlined"
            maxlength={100}
            disabled={disabled}
          />
        </FormField>
      </FormSection>

      <FormSection title="路由设置">
        <FormField label="路由路径">
          <TextField
            value={values.path}
            onChange={(path) => set({ path })}
            placeholder="如 /system/user"
            maxlength={255}
            disabled={disabled}
          />
        </FormField>
        {!isDirectory ? (
          <FormField label="组件路径" required={!values.isExternalLink}>
            <TextField
              value={values.component}
              onChange={(component) => set({ component })}
              placeholder={values.isExternalLink ? '外链无需组件路径' : './system/user'}
              maxlength={255}
              disabled={disabled}
            />
          </FormField>
        ) : null}
        <SwitchField
          label="外部链接"
          checked={values.isExternalLink}
          disabled={disabled}
          onChange={(isExternalLink) => set({ isExternalLink })}
        />
      </FormSection>

      <FormSection title="显示设置">
        <EnumField
          label="状态"
          value={values.status}
          options={[
            { value: '1', label: '启用' },
            { value: '0', label: '禁用' },
          ]}
          disabled={disabled}
          onChange={(status) => set({ status: status as '0' | '1' })}
        />
        <FormField label="排序">
          <TextField
            value={values.sort}
            onChange={(sort) => set({ sort })}
            placeholder="非负整数，越小越靠前"
            disabled={disabled}
          />
        </FormField>
        <SwitchField
          label="在菜单中隐藏"
          checked={values.hideInMenu}
          disabled={disabled}
          onChange={(hideInMenu) => set({ hideInMenu })}
        />
        {!isDirectory ? (
          <SwitchField
            label="缓存页面"
            checked={values.keepAlive}
            disabled={disabled}
            onChange={(keepAlive) => set({ keepAlive })}
          />
        ) : null}
        {values.type === 2 ? (
          <SwitchField
            label="页面默认访问操作"
            checked={values.isDefaultAction}
            disabled={disabled}
            onChange={(isDefaultAction) => set({ isDefaultAction })}
          />
        ) : null}
      </FormSection>

      {/* 关联功能独立成页：菜单属性配置与权限点授权是两件事，
          把一份几十项的功能目录塞进编辑页会把表单撑得很长。 */}
      {!isDirectory && id ? (
        <FormSection title="权限关联">
          <LinkRow
            label="关联功能"
            value={values.permissionCodes.length ? `已选择 ${values.permissionCodes.length} 个` : "未选择"}
            onClick={() => navigateTo(`/${SYSTEM_PAGES.menuPermissions}?id=${id}`)}
          />
        </FormSection>
      ) : null}
    </MenuFormScaffold>
  )
}
export default withAccountScope(MenuFormPage)
