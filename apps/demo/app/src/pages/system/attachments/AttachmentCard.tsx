import { useEffect, useRef, useState } from 'react'
import { Image, Text, Video, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { attachmentUrl, deleteAttachment, getAttachment, updateAttachment, folderOptions, type Attachment, type AttachmentFolder } from '@/api/admin/attachments'
import { Button } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { confirmAction, useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { AdminNotice, AdminSelect, errorMessage } from '../_shared/AdminUI'

export default function AttachmentCard({ item, folders, domain, selected, onSelect, onSaved }: {
  item: Attachment; folders: AttachmentFolder[]; domain?: string; selected: boolean; onSelect: () => void; onSaved: () => void
}) {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const isCurrent = useCurrentModuleAccess('system-attachments')
  const canUpdate = useCanWrite('system:attachment:update')
  const canDelete = useCanWrite('system:attachment:delete')
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<Attachment | null>(null)
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState('0')
  const [enabled, setEnabled] = useState(true)
  const [metadata, setMetadata] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const locked = useRef(false)
  const audio = useRef<ReturnType<typeof Taro.createInnerAudioContext> | null>(null)
  const access = useRef({ allowed: false, update: false, remove: false })
  access.current = { allowed: guard.allowed, update: guard.allowed && canUpdate, remove: guard.allowed && canDelete }
  useEffect(() => () => { audio.current?.destroy() }, [])
  useEffect(() => {
    if (!open || !guard.allowed) { audio.current?.stop(); return }
    let active = true
    setLoading(true)
    setError('')
    setDetail(null)
    getAttachment(item.id).then((data) => {
      if (!active) return
      setDetail(data); setName(data.name || ''); setFolderId(String(data.folderId || 0)); setEnabled(data.status === '1'); setMetadata(data.metadata == null ? '' : JSON.stringify(data.metadata, null, 2))
    }).catch((reason) => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, guard.allowed, item.id, revision])
  const save = async () => {
    if (!access.current.update || !isCurrent(['system:attachment:update']) || !detail || locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      const nextMetadata: unknown = metadata.trim() ? JSON.parse(metadata) : null
      const result = await updateAttachment(item.id, { name, folderId: Number(folderId) || null, status: enabled ? '1' : '0', metadata: nextMetadata })
      if (!isCurrent(['system:attachment:update'])) return
      setDetail(result)
      setOpen(false)
      onSaved()
      await Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (reason) { if (isCurrent()) setError(errorMessage(reason)) }
    finally { locked.current = false; if (isCurrent()) setBusy(false) }
  }
  const remove = async () => {
    if (!access.current.remove || !isCurrent(['system:attachment:delete']) || locked.current) return
    locked.current = true
    setBusy(true)
    try {
      if (!await confirmAction({ title: '删除素材', content: `确认删除「${item.name || item.originalName}」？` }) || !access.current.remove || !isCurrent(['system:attachment:delete'])) return
      await deleteAttachment(item.id)
      if (!isCurrent(['system:attachment:delete'])) return
      onSaved()
    } catch (reason) { if (isCurrent()) setError(errorMessage(reason)) }
    finally { locked.current = false; if (isCurrent()) setBusy(false) }
  }
  const url = attachmentUrl(detail || item, domain)
  const previewAudio = () => {
    if (!url || !access.current.allowed || !isCurrent()) return
    audio.current?.destroy()
    const player = Taro.createInnerAudioContext()
    audio.current = player
    player.src = url
    player.onError(() => setError('音频无法播放，请检查文件链接'))
    player.play()
  }
  return <View className="admin-card">
    <Text className="admin-name">{item.name || item.originalName}</Text>
    <Text className="admin-meta">{item.kind} · {(item.size / 1024).toFixed(1)} KB · {item.folderName || '未分组'} · {item.status === '1' ? '启用' : '禁用'}</Text>
    <View className="admin-actions"><Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>{open ? '收起详情' : '详情'}</Button>{canDelete && <><Button size="sm" variant="secondary" onClick={onSelect}>{selected ? '取消选择' : '选择'}</Button><Button size="sm" variant="danger" disabled={busy} onClick={remove}>删除</Button></>}</View>
    {error && <AdminNotice>{error}</AdminNotice>}
    {open && (loading ? <StateView kind="loading" /> : !detail ? <StateView kind="error" text={error || '详情加载失败'} onRetry={() => setRevision(revision + 1)} /> : <>
      <Text className="admin-meta">原始文件 {detail.originalName} · MIME {detail.mimeType} · 存储 {detail.storage}</Text>
      <Text className="admin-meta">创建 {detail.createdAt} · 更新 {detail.updatedAt}</Text>
      {detail.width && <Text className="admin-meta">尺寸 {detail.width} × {detail.height}</Text>}
      {detail.duration && <Text className="admin-meta">时长 {detail.duration} 秒</Text>}
      {url && <>
        {detail.kind === 'image' && <Image src={url} mode="widthFix" style={{ width: '100%' }} onClick={() => Taro.previewImage({ current: url, urls: [url] })} onError={() => setError('图片无法加载')} />}
        {detail.kind === 'video' && <Video src={url} controls style={{ width: '100%' }} onError={() => setError('视频无法播放')} />}
        {detail.kind === 'audio' && <View className="admin-actions"><Button size="sm" onClick={previewAudio}>播放音频</Button><Button size="sm" variant="secondary" onClick={() => audio.current?.stop()}>停止</Button></View>}
        <Button size="sm" variant="secondary" onClick={() => Taro.setClipboardData({ data: url })}>复制文件链接</Button>
      </>}
      {!url && <AdminNotice>该素材暂时没有可预览的访问链接。</AdminNotice>}
      <FormField type="input" label="素材名称" value={name} maxLength={255} disabled={!canUpdate || busy} onInput={setName} />
      <AdminSelect label="分组" value={folderId} options={folderOptions(folders)} disabled={!canUpdate || busy} onChange={setFolderId} />
      <FormField type="switch" label="启用" checked={enabled} disabled={!canUpdate || busy} onChange={setEnabled} />
      <FormField type="textarea" label="扩展信息（JSON）" value={metadata} maxLength={-1} disabled={!canUpdate || busy} onInput={setMetadata} />
      {canUpdate && <Button loading={busy} onClick={save}>保存修改</Button>}
    </>)}
  </View>
}
