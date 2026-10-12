import Taro, { useRouter } from '@tarojs/taro'
import { Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import {
  createAdminMenu,
  getAdminMenu,
  getAdminMenuTree,
  updateAdminMenu,
  type AdminMenu,
} from '@/api/admin/menu'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  EnumField,
  FormContent,
  FormField,
  FormSection,
  FormSubmitBar,
  LinkRow,
  ManagementPage,
  SwitchField,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { MENU_TYPE_LABELS } from '../filters'
import { menuDraft, menuPayload, type MenuFormValues } from '../model'
import { menuParentOptions } from '../parents'
import styles from './index.module.scss'

// 类型文案与列表、详情一致：都来自 MenuTypeBadge，不再各写一套「按钮/操作」
const TYPE_OPTIONS = [
  { value: '1' as const, label: MENU_TYPE_LABELS[1] },
  { value: '0' as const, label: MENU_TYPE_LABELS[0] },
  { value: '2' as const, label: MENU_TYPE_LABELS[2] },
]

function MenuFormPage() {
  const guard = useRequireAuth({ moduleId: 'system-menu' })
  const params = useRouter().params
  const rawId = params.id
  const rawParentId = params.parentId
  const id = rawId ? Number(rawId) : undefined
  const parentId = rawParentId ? Number(rawParentId) : undefined
  const required = rawId ? 'system:menu:update' : 'system:menu:create'
  const canSave = useCanWrite(required)
  const [values, setValues] = useState<MenuFormValues>(() => menuDraft(parentId))
  const [tree, setTree] = useState<AdminMenu[]>([])
  const [loading, setLoading] = useState(Boolean(rawId))
  const [loaded, setLoaded] = useState(!rawId)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()
  const set = (patch: Partial<MenuFormValues>) => setValues((current) => ({ ...current, ...patch }))

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5')
      void Taro.setNavigationBarTitle({ title: rawId ? '编辑菜单' : '新建菜单' })
  }, [rawId])

  useEffect(() => {
    mounted.current = true
    let current = true
    const alive = () => current && active()
    const detail = rawId
      ? getAdminMenu(Number(rawId))
          .then((menu) => {
            if (!alive()) return
            setValues({
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
            })
            setLoaded(true)
          })
          .catch((cause) => {
            if (alive()) setError(errorMessage(cause))
          })
      : Promise.resolve()
    const options = getAdminMenuTree()
      .then((nodes) => {
        if (alive()) setTree(nodes)
      })
      .catch(() => {
        // 上级菜单拉不到就不让它阻断保存：新建顶级菜单本身不依赖这棵树。
      })
    setLoading(Boolean(rawId))
    setLoaded(!rawId)
    setError('')
    void Promise.all([detail, options]).finally(() => {
      if (alive()) setLoading(false)
    })
    return () => {
      current = false
      mounted.current = false
    }
  }, [rawId, retry, session])

  const disabled = !canSave || busy || loading || !loaded
  const isDirectory = values.type === 0
  const parentOptions = menuParentOptions(tree, id)

  async function save() {
    if (disabled || locked.current || !active() || !canWriteModuleNow('system-menu', [required]))
      return
    let payload: ReturnType<typeof menuPayload>
    try {
      payload = menuPayload(values)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      if (id) await updateAdminMenu(id, payload)
      else await createAdminMenu(payload)
      if (active() && canWriteModuleNow('system-menu', [required])) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? (
        <PageHeader title={rawId ? '编辑菜单' : '新建菜单'} />
      ) : null}
      <StateView
        kind={error ? 'error' : loading ? 'loading' : 'ready'}
        text={error || undefined}
        onRetry={() => setRetry((value) => value + 1)}
      >
        <FormContent>
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
            <FormField label="排序">
              <TextField
                value={values.sort}
                onChange={(sort) => set({ sort })}
                placeholder="非负整数，越小越靠前"
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
              <FormField
                label="组件路径"
                required={!values.isExternalLink}
              >
                <TextField
                  value={values.component}
                  onChange={(component) => set({ component })}
                  placeholder={values.isExternalLink ? '外链无需组件路径' : './system/user'}
                  maxlength={255}
                  disabled={disabled}
                />
              </FormField>
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

          {submitError ? <Text className={styles.error}>{submitError}</Text> : null}
        </FormContent>
        {canSave && loaded ? (
          <FormSubmitBar text="保存" submitting={busy} onSubmit={() => void save()} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}
export default withAccountScope(MenuFormPage)
