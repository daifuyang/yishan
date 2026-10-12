import { useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { createFolder, getFolder, updateFolder, folderOptions, type AttachmentFolder, type FolderInput } from '@/api/admin/attachments'
import { Button } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { AdminNotice, AdminSelect, errorMessage } from '../_shared/AdminUI'

export const kindOptions = [{ label: '全部', value: 'all' }, { label: '图片', value: 'image' }, { label: '音频', value: 'audio' }, { label: '视频', value: 'video' }, { label: '其他', value: 'other' }]
const empty: FolderInput = { name: '', parentId: 0, kind: 'all', status: '1', sort_order: 0, remark: '' }

export default function FolderForm({ folder, folders, onSaved }: { folder?: AttachmentFolder; folders: AttachmentFolder[]; onSaved: () => void }) {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const isCurrent = useCurrentModuleAccess('system-attachments')
  const canWrite = useCanWrite(folder ? 'system:attachment:update' : 'system:attachment:create')
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<FolderInput>(empty)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const locked = useRef(false)
  const access = useRef(false)
  access.current = guard.allowed && canWrite && open
  useEffect(() => {
    if (!open || !guard.allowed) return
    let active = true
    setError('')
    setLoaded(false)
    if (!folder) { setValues(empty); setLoaded(true); return }
    setLoading(true)
    getFolder(folder.id).then((data) => {
      if (active) { setValues({ name: data.name, parentId: data.parentId || 0, kind: data.kind, status: data.status, sort_order: data.sort_order, remark: data.remark || '' }); setLoaded(true) }
    }).catch((reason) => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, guard.allowed, folder?.id, revision])
  const save = async () => {
    const required = [folder ? 'system:attachment:update' : 'system:attachment:create']
    if (!access.current || !isCurrent(required) || !loaded || locked.current) return
    if (!values.name.trim()) { setError('请输入分组名称'); return }
    if (!Number.isFinite(values.sort_order)) { setError('排序必须为有效数字'); return }
    locked.current = true
    setSaving(true)
    setError('')
    try {
      const data = { ...values, name: values.name.trim() }
      if (folder) await updateFolder(folder.id, data)
      else await createFolder(data)
      if (!isCurrent(required)) return
      setOpen(false)
      onSaved()
      await Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (reason) { if (isCurrent()) setError(errorMessage(reason)) }
    finally { locked.current = false; if (isCurrent()) setSaving(false) }
  }
  if (!guard.allowed || !canWrite) return null
  return <>
    <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{folder ? '编辑分组' : '新建分组'}</Button>
    {open && <View className="admin-card">
      <Text className="admin-section-title">{folder ? '编辑分组' : '新建分组'}</Text>
      {loading ? <StateView kind="loading" /> : !loaded ? <StateView kind="error" text={error} onRetry={() => setRevision(revision + 1)} /> : <>
        <FormField type="input" label="分组名称" required value={values.name} maxLength={100} disabled={saving} onInput={(name) => setValues({ ...values, name })} />
        <AdminSelect label="上级分组" value={String(values.parentId || 0)} options={folderOptions(folders, folder?.id)} disabled={saving} onChange={(parentId) => setValues({ ...values, parentId: Number(parentId) })} />
        <AdminSelect label="素材类型" value={values.kind} options={kindOptions} disabled={saving} onChange={(kind) => { if (kind === 'all' || kind === 'image' || kind === 'audio' || kind === 'video' || kind === 'other') setValues({ ...values, kind }) }} />
        <FormField type="switch" label="启用" checked={values.status === '1'} disabled={saving} onChange={(enabled) => setValues({ ...values, status: enabled ? '1' : '0' })} />
        <FormField type="input" inputType="number" label="排序" value={String(values.sort_order)} disabled={saving} onInput={(value) => setValues({ ...values, sort_order: Number(value) })} />
        <FormField type="textarea" label="备注" value={values.remark || ''} maxLength={255} disabled={saving} onInput={(remark) => setValues({ ...values, remark })} />
        {error && <AdminNotice>{error}</AdminNotice>}
        <Button loading={saving} onClick={save}>保存分组</Button>
      </>}
      <Button variant="secondary" disabled={saving} onClick={() => setOpen(false)}>取消</Button>
    </View>}
  </>
}
