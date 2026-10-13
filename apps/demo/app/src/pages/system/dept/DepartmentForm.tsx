import { useEffect, useRef, useState } from 'react'
import { Picker, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  EnumField,
  FormContent,
  FormSection,
  FormField,
  TextField,
  TextAreaField,
  FormSubmitBar,
  LineIcon,
} from '@/components/management'
import styles from './DepartmentForm.module.scss'
import { useCanWrite } from '@/hooks'
import type { AdminDept } from '@/api/admin/types'
import * as api from '@/api/admin/dept'
import { errorMessage } from '@/utils/account-scope'
import { AdminNotice } from '../_shared/AdminUI'
import { departmentParentOptions, departmentPayload, type DepartmentFormValues } from './form'
import { useCurrentModuleAccess } from '@/utils/auth-guard'

export default function DepartmentForm({
  department,
  departmentId,
  parentId = 0,
  onSuccess,
}: {
  department?: AdminDept
  departmentId?: number
  parentId?: number
  onCancel?: () => void
  onSuccess: () => void
}) {
  const editId = departmentId ?? department?.id
  const [loadedDepartment, setLoadedDepartment] = useState(department)
  const permission = editId ? 'system:department:update' : 'system:department:create'
  const canSave = useCanWrite(permission)
  const canList = useCanWrite('system:department:list')
  const isCurrent = useCurrentModuleAccess('system-dept')
  const [values, setValues] = useState<DepartmentFormValues>({
    name: department?.name || '',
    parentId: String(loadedDepartment?.parentId || parentId),
    status: department?.status || '1',
    sort: String(department?.sort_order || 0),
    description: department?.description || '',
    leaderId: loadedDepartment?.leaderId ? String(loadedDepartment.leaderId) : '',
  })
  const [tree, setTree] = useState<AdminDept[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
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
    let current = true
    if (!canList) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    Promise.all([
      api.getAdminDeptTree(),
      editId ? api.getAdminDept(editId) : Promise.resolve(undefined),
    ])
      .then(([nodes, detail]) => {
        if (!current || !isCurrent()) return
        setTree(nodes)
        if (detail) {
          setLoadedDepartment(detail)
          setValues({
            name: detail.name,
            parentId: String(detail.parentId || 0),
            status: detail.status,
            sort: String(detail.sort_order),
            description: detail.description || '',
            leaderId: detail.leaderId ? String(detail.leaderId) : '',
          })
        }
      })
      .catch((cause) => {
        if (current && isCurrent()) setLoadError(errorMessage(cause))
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [editId, canList, reload])
  const field = (name: keyof DepartmentFormValues, value: string) =>
    setValues((previous) => ({ ...previous, [name]: value }))
  const save = async () => {
    if (
      !canSave ||
      !canList ||
      !isCurrent([permission]) ||
      lock.current ||
      loading ||
      loadError ||
      (editId && !loadedDepartment)
    )
      return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const payload = departmentPayload(values)
      if (loadedDepartment?.parentId && values.parentId === '0') throw new Error('请选择上级部门')
      if (editId) await api.updateAdminDept(editId, payload)
      else await api.createAdminDept(payload)
      if (!alive.current || !isCurrent([permission])) return
      await Taro.showToast({ title: '保存成功', icon: 'success' })
      if (isCurrent([permission])) onSuccess()
    } catch (cause) {
      if (alive.current && isCurrent([permission])) setError(errorMessage(cause))
    } finally {
      lock.current = false
      if (alive.current) setSaving(false)
    }
  }
  const disabled = loading || saving || !canSave || !canList
  const parentOptions = departmentParentOptions(tree, editId).filter(
    (option) => !loadedDepartment?.parentId || option.value !== '0',
  )
  return (
    <>
      <FormContent>
        <FormSection title="基础信息">
          <FormField label="部门名称" required>
            <TextField
              value={values.name}
              maxlength={100}
              placeholder="请输入部门名称"
              disabled={disabled}
              onChange={(value) => field('name', value)}
            />
          </FormField>
          <FormField label="上级部门" disabled={disabled}>
            <Picker
              className={styles.picker}
              disabled={disabled}
              range={parentOptions.map((option) => option.label)}
              value={Math.max(
                parentOptions.findIndex((option) => option.value === values.parentId),
                0,
              )}
              onChange={(event) => {
                const option = parentOptions[Number(event.detail.value)]
                if (option) field('parentId', option.value)
              }}
            >
              <View className={styles.pickerValue}>
                <Text>
                  {parentOptions.find((option) => option.value === values.parentId)?.label ||
                    '请选择'}
                </Text>
                <LineIcon name="chevronRight" size={16} color="#C9CDD4" />
              </View>
            </Picker>
          </FormField>
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
          <FormField label="排序">
            <TextField
              value={values.sort}
              disabled={disabled}
              placeholder="非负整数，越小越靠前"
              onChange={(value) => field('sort', value)}
            />
          </FormField>
        </FormSection>
        <FormSection title="补充信息">
          <FormField
            label="负责人用户 ID"
            note={
              loadedDepartment?.leaderId
                ? `当前：${loadedDepartment.leaderName || loadedDepartment.leaderId}；留空保留`
                : '可选'
            }
          >
            <TextField
              value={values.leaderId}
              disabled={disabled}
              onChange={(value) => field('leaderId', value)}
              placeholder="请输入用户 ID"
            />
          </FormField>
          <FormField label="部门描述" stacked>
            <TextAreaField
              value={values.description}
              maxlength={255}
              disabled={disabled}
              onChange={(value) => field('description', value)}
              placeholder="请输入部门描述"
            />
          </FormField>
        </FormSection>
        {loading && <AdminNotice>加载部门信息…</AdminNotice>}
        {error && <AdminNotice>{error}</AdminNotice>}
        {loadError && (
          <View className={styles.error} onClick={() => setReload((count) => count + 1)}>
            <Text>{loadError}，点击重新加载</Text>
          </View>
        )}
      </FormContent>
      <FormSubmitBar text="保存" submitting={disabled || Boolean(loadError)} onSubmit={save} />
    </>
  )
}
