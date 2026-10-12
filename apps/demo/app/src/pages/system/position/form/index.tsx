import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { createAdminPosition, getAdminPosition, updateAdminPosition } from '@/api/admin/position'
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
  TextAreaField,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { positionPayload } from '../model'

function PositionFormPage() {
  const guard = useRequireAuth({ moduleId: 'system-position' })
  const rawId = useRouter().params.id
  const id = rawId ? Number(rawId) : undefined
  const required = rawId ? 'system:position:update' : 'system:position:create'
  const canSave = useCanWrite(required)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'0' | '1'>('1')
  const [sort, setSort] = useState('0')
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
  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5')
      void Taro.setNavigationBarTitle({ title: rawId ? '编辑岗位' : '新建岗位' })
  }, [rawId])
  useEffect(() => {
    mounted.current = true
    let current = true
    if (rawId && guard.ready && guard.allowed) {
      setLoading(true)
      setLoaded(false)
      setError('')
      void (async () => {
        try {
          if (!id || !Number.isInteger(id) || id <= 0) throw new Error('岗位 ID 缺失或无效')
          const position = await getAdminPosition(id)
          if (!current || !active()) return
          setName(position.name)
          setDescription(position.description || '')
          setStatus(position.status)
          setSort(String(position.sort_order))
          setLoaded(true)
        } catch (cause) {
          if (current && active()) setError(errorMessage(cause))
        } finally {
          if (current && active()) setLoading(false)
        }
      })()
    }
    return () => {
      current = false
      mounted.current = false
    }
  }, [id, rawId, retry, guard.ready, guard.allowed, session])
  const disabled = !canSave || busy || loading || !loaded
  async function save() {
    if (
      disabled ||
      locked.current ||
      !active() ||
      !canWriteModuleNow('system-position', [required])
    )
      return
    let payload: ReturnType<typeof positionPayload>
    try {
      payload = positionPayload(name, description, status, sort)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      if (id) await updateAdminPosition(id, payload)
      else await createAdminPosition(payload)
      if (active() && canWriteModuleNow('system-position', [required])) {
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
        <PageHeader title={rawId ? '编辑岗位' : '新建岗位'} />
      ) : null}
      <StateView
        kind={error ? 'error' : loading ? 'loading' : 'ready'}
        text={error || undefined}
        onRetry={() => setRetry((value) => value + 1)}
      >
        <FormContent>
          <FormSection title="基础信息">
            <FormField label="岗位名称" required>
              <TextField
                value={name}
                onChange={setName}
                placeholder="请输入岗位名称"
                maxlength={100}
                disabled={disabled}
              />
            </FormField>
            <EnumField
              label="状态"
              value={status}
              options={[
                { value: '1', label: '启用' },
                { value: '0', label: '禁用' },
              ]}
              onChange={setStatus}
              disabled={disabled}
            />
            <FormField label="排序">
              <TextField
                value={sort}
                onChange={setSort}
                placeholder="非负整数，越小越靠前"
                disabled={disabled}
              />
            </FormField>
            <FormField label="岗位描述" stacked>
              <TextAreaField
                value={description}
                onChange={setDescription}
                placeholder="请输入岗位描述"
                maxlength={255}
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
export default withAccountScope(PositionFormPage)

