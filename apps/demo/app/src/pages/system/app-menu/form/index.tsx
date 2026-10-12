import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import {
  createAdminAppMenu,
  getAdminAppMenu,
  getAdminAppMenuTree,
  updateAdminAppMenu,
  type AdminAppMenu,
} from '@/api/admin/appMenu'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  EnumField,
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { appMenuDraft, appMenuGroupOptions, appMenuPayload, type AppMenuFormValues } from '../model'

function AppMenuFormPage() {
  const guard = useRequireAuth({ moduleId: 'system-app-menu' })
  const params = useRouter().params
  const rawId = params.id
  const rawParentId = params.parentId
  const id = rawId ? Number(rawId) : undefined
  const parentId = rawParentId ? Number(rawParentId) : undefined
  const required = rawId ? 'system:app-menu:update' : 'system:app-menu:create'
  const canSave = useCanWrite(required)
  const [values, setValues] = useState<AppMenuFormValues>(() => appMenuDraft(parentId))
  const [tree, setTree] = useState<AdminAppMenu[]>([])
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
  const set = (patch: Partial<AppMenuFormValues>) => setValues((current) => ({ ...current, ...patch }))

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5')
      void Taro.setNavigationBarTitle({ title: rawId ? '编辑工作台菜单' : '新建工作台菜单' })
  }, [rawId])

  useEffect(() => {
    mounted.current = true
    let current = true
    const alive = () => current && active()
    setLoading(Boolean(rawId))
    setLoaded(!rawId)
    setError('')
    const detail = rawId
      ? getAdminAppMenu(Number(rawId))
          .then((menu) => {
            if (!alive()) return
            setValues({
              name: menu.name,
              type: menu.type,
              parentId: menu.parentId,
              icon: menu.icon || '',
              page: menu.page || '',
              moduleId: menu.moduleId || 'core',
              status: menu.status,
              sort: String(menu.sortOrder ?? ''),
            })
            setLoaded(true)
          })
          .catch((cause) => {
            if (alive()) setError(errorMessage(cause))
          })
      : Promise.resolve()
    const groups = getAdminAppMenuTree()
      .then((nodes) => {
        if (alive()) setTree(nodes)
      })
      .catch(() => {
        // 分组拉不到不该阻断保存：新建分组本身不依赖这棵树。
        if (alive()) setTree([])
      })
    void Promise.all([detail, groups]).finally(() => {
      if (alive()) setLoading(false)
    })
    return () => {
      current = false
      mounted.current = false
    }
  }, [rawId, retry, session])

  const disabled = !canSave || busy || loading || !loaded
  const isGroup = values.type === 0
  const groupOptions = appMenuGroupOptions(tree, id)

  async function save() {
    if (disabled || locked.current || !active() || !canWriteModuleNow('system-app-menu', [required]))
      return
    let payload: ReturnType<typeof appMenuPayload>
    try {
      payload = appMenuPayload(values, tree)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      if (id) await updateAdminAppMenu(id, payload)
      else await createAdminAppMenu(payload)
      if (active() && canWriteModuleNow('system-app-menu', [required])) {
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
        <PageHeader title={rawId ? '编辑工作台菜单' : '新建工作台菜单'} />
      ) : null}
      <StateView
        kind={error ? 'error' : loading ? 'loading' : 'ready'}
        text={error || undefined}
        onRetry={() => setRetry((value) => value + 1)}
      >
        <FormContent>
          <FormSection title="基础信息">
            <EnumField
              label="类型"
              value={String(values.type)}
              options={[
                { value: '0', label: '分组' },
                { value: '1', label: '应用入口' },
              ]}
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
                options={groupOptions}
                placeholder="请选择分组"
                disabled={disabled}
                onChange={(value) => set({ parentId: value ? Number(value) : undefined })}
              />
            ) : null}
            <FormField label="图标名">
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

          <FormError>{submitError}</FormError>
        </FormContent>
        {canSave && loaded ? (
          <FormSubmitBar text="保存" submitting={busy} onSubmit={() => void save()} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}
export default withAccountScope(AppMenuFormPage)
