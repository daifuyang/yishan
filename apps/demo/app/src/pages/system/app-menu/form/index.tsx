import {
  createAdminAppMenu,
  getAdminAppMenu,
  getAdminAppMenuTree,
  updateAdminAppMenu,
} from '@/api/admin/appMenu'
import { EnumField, FormField, FormSection, TextField } from '@/components/management'
import { withAccountScope } from '@/utils/account-scope'
import { MenuFormScaffold, useMenuForm } from '../../_shared/MenuFormScaffold'
import {
  APP_MENU_TYPE_LABELS,
  appMenuDraft,
  appMenuGroupOptions,
  appMenuPayload,
  type AppMenuFormValues,
} from '../model'

const TYPE_OPTIONS = [
  { value: '0' as const, label: APP_MENU_TYPE_LABELS[0] },
  { value: '1' as const, label: APP_MENU_TYPE_LABELS[1] },
]

function AppMenuFormPage() {
  const form = useMenuForm({
    noun: '工作台菜单',
    moduleId: 'system-app-menu',
    permission: 'system:app-menu',
    draft: appMenuDraft,
    fetch: getAdminAppMenu,
    toValues: (menu): AppMenuFormValues => ({
      name: menu.name,
      type: menu.type,
      parentId: menu.parentId,
      icon: menu.icon || '',
      page: menu.page || '',
      moduleId: menu.moduleId || 'core',
      status: menu.status,
      sort: String(menu.sortOrder ?? ''),
    }),
    fetchTree: getAdminAppMenuTree,
    payload: appMenuPayload,
    create: createAdminAppMenu,
    update: updateAdminAppMenu,
  })
  const { values, set, disabled } = form
  const isGroup = values.type === 0

  return (
    <MenuFormScaffold form={form}>
      <FormSection title="基础信息">
        <EnumField
          label="类型"
          value={String(values.type)}
          options={TYPE_OPTIONS}
          disabled={disabled}
          onChange={(value) => set({ type: Number(value) as AppMenuFormValues['type'] })}
        />
        <FormField label="名称" required>
          <TextField
            value={values.name}
            onChange={(name) => set({ name })}
            placeholder="请输入名称"
            maxlength={100}
            disabled={disabled}
          />
        </FormField>
        {!isGroup ? (
          <EnumField
            label="所属分组"
            value={values.parentId == null ? '' : String(values.parentId)}
            options={appMenuGroupOptions(form.tree, form.id)}
            placeholder="请选择分组"
            disabled={disabled}
            onChange={(value) => set({ parentId: value ? Number(value) : undefined })}
          />
        ) : null}
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

      {!isGroup ? (
        <FormSection title="入口设置">
          <FormField label="页面路径" required>
            <TextField
              value={values.page}
              onChange={(page) => set({ page })}
              placeholder="pages/system/user/index"
              maxlength={255}
              disabled={disabled}
            />
          </FormField>
          {/* 所属模块不在表单里暴露，但会随 values 原样带回，编辑不会把它抹掉 */}
        </FormSection>
      ) : null}

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
            placeholder="留空排在末尾"
            disabled={disabled}
          />
        </FormField>
      </FormSection>
    </MenuFormScaffold>
  )
}
export default withAccountScope(AppMenuFormPage)
