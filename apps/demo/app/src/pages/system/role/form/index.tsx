import Taro, { useRouter } from '@tarojs/taro'
import { Picker, Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import * as adminRoleApi from '@/api/admin/role'
import * as adminAppMenuApi from '@/api/admin/appMenu'
import type { AdminRoleDetail } from '@/api/admin/role'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  FormContent,
  FormField,
  FormSection,
  FormSubmitBar,
  LinkRow,
  ManagementPage,
  TextAreaField,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import styles from './index.module.scss'
import { PERMS, SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack, navigateTo } from '@/utils/router'
import { withAccountScope } from '../../_shared/AdminUI'
import { DATA_SCOPE_LABELS } from '../model'
import { appMenuEntrySummary } from '../permissions'

const STATUS_OPTIONS = [
  { value: '1', label: '启用' },
  { value: '0', label: '禁用' },
] as const

const SCOPE_OPTIONS = (Object.keys(DATA_SCOPE_LABELS) as (keyof typeof DATA_SCOPE_LABELS)[]).map(
  (value) => ({ value, label: DATA_SCOPE_LABELS[value] }),
)

function RoleFormPage() {
  const guard = useRequireAuth({ moduleId: 'system-role' })
  const router = useRouter()
  const rawId = router.params.id
  const id = rawId ? Number(rawId) : undefined
  const isEdit = Boolean(id && Number.isInteger(id) && id > 0)

  const canSave = useCanWrite(
    isEdit ? 'system:role:update' : 'system:role:create',
    'system:role:grant',
  )
  const canListAppMenus = useCanWrite(PERMS.appMenuList)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'0' | '1'>('1')
  const [dataScope, setDataScope] = useState<AdminRoleDetail['dataScope']>('1')
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState<string | null>(null)
  const [menuCount, setMenuCount] = useState(0)
  const [permissionCount, setPermissionCount] = useState(0)
  const [appMenuSummary, setAppMenuSummary] = useState('')
  const [nameError, setNameError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const loadedFor = useRef<number | null>(null)

  useEffect(() => {
    if (!isEdit || loadedFor.current === id) return
    loadedFor.current = id as number
    let active = true
    void (async () => {
      setLoading(true)
      try {
        // 工作台树只用来只数入口；拿不到时摘要退化为「已配置/未配置」
        const [role, groups] = await Promise.all([
          adminRoleApi.getAdminRole(id as number),
          canListAppMenus
            ? adminAppMenuApi.getAdminAppMenuTree().catch(() => null)
            : Promise.resolve(null),
        ])
        if (!active) return
        setName(role.name)
        setDescription(role.description ?? '')
        setStatus(role.status)
        setDataScope(role.dataScope)
        setMenuCount(role.menuIds?.length ?? 0)
        setPermissionCount(role.permissionCodes?.length ?? 0)
        setAppMenuSummary(appMenuEntrySummary(role.appMenuIds, groups))
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, id])

  const goPermissions = (page: string = SYSTEM_PAGES.rolePermissions) => {
    if (!isEdit) {
      Taro.showToast({ title: '请先保存角色', icon: 'none' })
      return
    }
    navigateTo(`/${page}?id=${id}`)
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const handleSubmit = async () => {
    if (submittingRef.current) return
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('请输入角色名称')
      return
    }
    setNameError('')
    submittingRef.current = true
    setSubmitting(true)
    const session = getSessionVersion()
    try {
      const payload = {
        name: trimmed,
        description: description.trim() || undefined,
        status,
        dataScope,
      }
      if (isEdit) await adminRoleApi.updateAdminRole(id as number, payload)
      else
        await adminRoleApi.createAdminRole({
          ...payload,
          menuIds: [],
          permissionCodes: [],
          appMenuIds: [],
        })
      if (session !== getSessionVersion()) return
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => navigateBack(1), 600)
    } catch (e) {
      if (session === getSessionVersion()) {
        Taro.showToast({ title: e instanceof Error ? e.message : '保存失败', icon: 'none' })
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const kind = error ? 'error' : loading ? 'loading' : 'ready'

  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? (
        <PageHeader title={isEdit ? '编辑角色' : '新建角色'} />
      ) : null}
      <StateView
        kind={kind}
        text={error ?? undefined}
        onRetry={() => setError(null)}
        minHeight={200}
      >
        <FormContent>
          <FormSection title="基础信息">
            <FormField label="角色名称" required error={nameError}>
              <TextField
                value={name}
                onChange={(value) => {
                  setName(value)
                  if (nameError) setNameError('')
                }}
                placeholder="请输入角色名称"
                maxlength={50}
                disabled={!canSave || submitting}
              />
            </FormField>
            <FormField label="描述" stacked>
              <TextAreaField
                value={description}
                onChange={setDescription}
                placeholder="请输入角色描述"
                maxlength={200}
                disabled={!canSave || submitting}
              />
            </FormField>
            <FormField label="状态" arrow>
              <Picker
                className={styles.picker}
                mode="selector"
                range={STATUS_OPTIONS.map((option) => option.label)}
                value={Math.max(STATUS_OPTIONS.findIndex((option) => option.value === status), 0)}
                onChange={(event) =>
                  setStatus(STATUS_OPTIONS[Number(event.detail.value)]?.value ?? status)
                }
              >
                <View className={styles.pickerValue}>
                  <Text>{STATUS_OPTIONS.find((option) => option.value === status)?.label ?? '启用'}</Text>
                </View>
              </Picker>
            </FormField>
            <FormField label="数据权限" arrow>
              <Picker
                className={styles.picker}
                mode="selector"
                range={SCOPE_OPTIONS.map((option) => option.label)}
                value={Math.max(
                  SCOPE_OPTIONS.findIndex((option) => option.value === dataScope),
                  0,
                )}
                onChange={(event) =>
                  setDataScope(SCOPE_OPTIONS[Number(event.detail.value)]?.value ?? dataScope)
                }
              >
                <View className={styles.pickerValue}>
                  <Text>
                    {SCOPE_OPTIONS.find((option) => option.value === dataScope)?.label ?? '全部数据'}
                  </Text>
                </View>
              </Picker>
            </FormField>
          </FormSection>

          <FormSection title="权限配置">
            {/* 与角色详情页同一组、同一对标签：详情页看数量，编辑页从这里进内页 */}
            <LinkRow
              label="功能授权"
              value={isEdit ? `${menuCount} 个菜单，${permissionCount} 项操作` : '保存后可配置'}
              onClick={() => goPermissions()}
            />
            <LinkRow
              label="App 工作台"
              value={isEdit ? appMenuSummary : '保存后可配置'}
              onClick={() => goPermissions(SYSTEM_PAGES.roleWorkbench)}
            />
          </FormSection>
        </FormContent>

        {canSave ? (
          <FormSubmitBar text="保存" submitting={submitting} onSubmit={() => void handleSubmit()} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}

export default withAccountScope(RoleFormPage)
