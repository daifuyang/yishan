import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import * as api from '@/api/admin/dict'
import { StateView } from '@/components/feedback'
import {
  EnumField,
  SwitchField,
  FormContent,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  ManagementPageHeader,
  TextAreaField,
  TextField,
} from '@/components/management'
import { useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage } from '@/utils/account-scope'
import {
  dictionaryDraft,
  dictionaryDataPayload,
  dictionaryTypePayload,
  type DictionaryFormValues,
} from './form'

export default function DictionaryForm({ item = false }: { item?: boolean }) {
  const guard = useRequireAuth({ moduleId: 'system-dict' })
  const current = useCurrentModuleAccess('system-dict')
  const params = useRouter().params
  const id = params.id ? Number(params.id) : undefined
  const permission = id !== undefined ? 'system:dict:update' : 'system:dict:create'
  useEffect(() => {
    if (guard.ready && guard.allowed)
      void Taro.setNavigationBarTitle({
        title: (id !== undefined ? '编辑' : '新建') + (item ? '字典项' : '字典类型'),
      })
  }, [id, item, guard.ready, guard.allowed])
  const canSave = useCanWrite(permission)
  const [typeId, setTypeId] = useState(Number(params.typeId))
  const [typeName, setTypeName] = useState('')
  const [values, setValues] = useState<DictionaryFormValues>(dictionaryDraft())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const lock = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    if (!guard.ready || !guard.allowed) return
    let active = true
    setLoading(true)
    setLoadError('')
    void (async () => {
      try {
        let contextId = Number(params.typeId)
        if (id !== undefined) {
          if (!Number.isInteger(id) || id < 1) throw new Error('字典参数无效')
          const record = item ? await api.getAdminDictData(id) : await api.getAdminDictType(id)
          if (!active || !current()) return
          setValues(dictionaryDraft(record))
          if ('typeId' in record) contextId = record.typeId
        }
        if (item) {
          if (!Number.isInteger(contextId) || contextId < 1) throw new Error('字典类型参数无效')
          const context = await api.getAdminDictType(contextId)
          if (!active || !current()) return
          setTypeId(context.id)
          setTypeName(context.name)
        }
      } catch (cause) {
        if (active && current()) setLoadError(errorMessage(cause))
      } finally {
        if (active && current()) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id, item, params.typeId, guard.ready, guard.allowed, reload])
  const field = (key: keyof DictionaryFormValues, value: string | boolean) =>
    setValues((previous) => ({ ...previous, [key]: value }))
  const save = async () => {
    if (lock.current || loading || loadError || !canSave || !current([permission])) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      if (item) {
        const payload = dictionaryDataPayload(values, typeId)
        if (id !== undefined) await api.updateAdminDictData(id, payload)
        else await api.createAdminDictData(payload)
      } else {
        const payload = dictionaryTypePayload(values)
        if (id !== undefined) await api.updateAdminDictType(id, payload)
        else await api.createAdminDictType(payload)
      }
      if (!alive.current || !current([permission])) return
      await Taro.showToast({ title: '保存成功', icon: 'success' })
      if (alive.current && current([permission])) navigateBack(1)
    } catch (cause) {
      if (alive.current && current([permission])) setError(errorMessage(cause))
    } finally {
      lock.current = false
      if (alive.current) setSaving(false)
    }
  }
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const disabled = saving || !canSave
  const text = (
    key: 'name' | 'type' | 'label' | 'value' | 'sort' | 'tag',
    label: string,
    required = false,
    maxlength = 100,
  ) => (
    <FormField label={label} required={required}>
      <TextField
        value={values[key]}
        onChange={(value) => field(key, value)}
        disabled={disabled}
        maxlength={maxlength}
        placeholder={`请输入${label}`}
      />
    </FormField>
  )
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? (
        <ManagementPageHeader
          title={`${id !== undefined ? '编辑' : '新建'}${item ? '字典项' : '字典类型'}`}
        />
      ) : null}
      <StateView
        kind={loadError ? 'error' : loading ? 'loading' : 'ready'}
        text={loadError || undefined}
        onRetry={() => setReload((value) => value + 1)}
      >
        <FormContent>
          <FormSection title="基础信息" hint={item ? `所属字典：${typeName}` : undefined}>
            {item ? (
              <>
                {text('label', '字典标签', true)}
                {text('value', '字典键值', true)}
              </>
            ) : (
              <>
                {text('name', '字典名称', true)}
                {text('type', '字典类型', true)}
              </>
            )}
            <EnumField
              label="状态"
              value={values.status}
              options={[
                { value: '1', label: '启用' },
                { value: '0', label: '禁用' },
              ]}
              disabled={disabled}
              onChange={(value) => field('status', value)}
            />
            {text('sort', '排序')}
          </FormSection>
          {item ? (
            <FormSection title="展示设置">
              {text('tag', '标签样式', false, 50)}
              <SwitchField
                label="默认值"
                checked={values.isDefault}
                disabled={disabled}
                onChange={(isDefault: boolean) => field('isDefault', isDefault)}
              />
            </FormSection>
          ) : null}
          <FormSection title="备注">
            <FormField label="备注" stacked>
              <TextAreaField
                value={values.remark}
                onChange={(value) => field('remark', value)}
                maxlength={255}
                disabled={disabled}
                placeholder="请输入备注（选填）"
              />
            </FormField>
          </FormSection>
          {error ? <StateView kind="error" text={error} /> : null}
        </FormContent>
        {canSave ? (
          <FormSubmitBar text="保存" submitting={saving} onSubmit={() => void save()} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}
