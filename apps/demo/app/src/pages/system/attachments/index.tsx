import { withAccountScope } from '../_shared/AdminUI'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { batchDeleteAttachments, deleteFolder, getCloudUploadConfig, getFolderTree, importImages, listAttachments, uploadAttachment, folderOptions, type Attachment, type AttachmentFolder, type AttachmentKind, type CloudUploadConfig, type UploadFile } from '@/api/admin/attachments'
import { Button } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { confirmAction, useCanWrite, useListPagination } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { AdminNotice, AdminPage, AdminSelect, errorMessage } from '../_shared/AdminUI'
import AttachmentCard from './AttachmentCard'
import FolderForm, { kindOptions } from './FolderForm'
import FileUpload from './FileUpload'

function kindOf(file: UploadFile): AttachmentKind {
  if (file.mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)) return 'image'
  if (file.mimeType.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(file.name)) return 'video'
  if (file.mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) return 'audio'
  return 'other'
}

function AttachmentsPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const isCurrent = useCurrentModuleAccess('system-attachments')
  const canCreate = useCanWrite('system:attachment:create')
  const canDelete = useCanWrite('system:attachment:delete')
  const canReadOptions = useCanWrite('system:option:list')
  const canCloudUpload = useCanWrite('system:storage:upload-token')
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersError, setFoldersError] = useState('')
  const [cloud, setCloud] = useState<CloudUploadConfig | undefined>()
  const [folderRevision, setFolderRevision] = useState(0)
  const [showFolders, setShowFolders] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [links, setLinks] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const locked = useRef(false)
  const access = useRef({ allowed: false, create: false, remove: false, cloud: false })
  access.current = { allowed: guard.allowed, create: guard.allowed && canCreate, remove: guard.allowed && canDelete, cloud: guard.allowed && canReadOptions && canCloudUpload }
  const list = useListPagination<Attachment>({ enabled: guard.ready && guard.allowed, fetcher: async ({ page, pageSize, keyword, filters }) => {
    const kind = filters.kind
    const status = filters.status
    const result = await listAttachments({ page, pageSize, keyword: keyword || undefined, folderId: Number(filters.folderId) || undefined,
      kind: kind === 'image' || kind === 'audio' || kind === 'video' || kind === 'other' ? kind : undefined,
      status: status === '0' || status === '1' ? status : undefined })
    return { list: result.data, total: result.pagination.total }
  } })
  useEffect(() => { setSelected([]) }, [list.keyword, list.filters])
  useEffect(() => {
    if (!guard.allowed) return
    let active = true
    setFoldersLoading(true)
    setFoldersError('')
    getFolderTree().then((data) => { if (active) setFolders(data) })
      .catch((reason) => { if (active) setFoldersError(errorMessage(reason)) })
      .finally(() => { if (active) setFoldersLoading(false) })
    return () => { active = false }
  }, [guard.allowed, folderRevision])
  useEffect(() => {
    setCloud(undefined)
    if (!guard.allowed || !canReadOptions) return
    let active = true
    getCloudUploadConfig().then((data) => { if (active) setCloud(data) })
      .catch((reason) => { if (active) setNotice(`云存储配置加载失败：${errorMessage(reason)}，可使用本地上传。`) })
    return () => { active = false }
  }, [guard.allowed, canReadOptions])
  const refresh = () => { setSelected([]); void list.refresh() }
  const refreshFolders = () => { setFolderRevision((value) => value + 1); refresh() }
  const upload = async (files: UploadFile[], useCloud = false) => {
    const required = useCloud ? ['system:attachment:create', 'system:option:list', 'system:storage:upload-token'] : ['system:attachment:create']
    if (!isCurrent(required) || !access.current.create || locked.current || (useCloud && !access.current.cloud)) return
    locked.current = true
    setBusy(true)
    setError('')
    let uploaded = 0
    try {
      for (const file of files) {
        if (!access.current.create || !isCurrent(required)) return
        await uploadAttachment(file, { folderId: Number(list.filters.folderId) || undefined, kind: kindOf(file) }, useCloud ? cloud : undefined)
        if (!isCurrent(required)) return
        uploaded++
      }
      if (uploaded) { setNotice(`已上传 ${uploaded} 个文件`); refresh() }
    } catch (reason) { if (isCurrent()) { setError(`${errorMessage(reason)}${uploaded ? `；已成功上传 ${uploaded} 个文件` : ''}`); if (uploaded) refresh() } }
    finally { locked.current = false; if (isCurrent()) setBusy(false) }
  }
  const choose = async (kind: 'image' | 'video', useCloud = false) => {
    if (!access.current.create || !isCurrent(['system:attachment:create']) || locked.current) return
    try {
      if (kind === 'image') {
        const result = await Taro.chooseImage({ count: 9 })
        if (!isCurrent(['system:attachment:create'])) return
        await upload(result.tempFiles.map((file) => ({ path: file.path, name: file.originalFileObj?.name || file.path.split('/').pop() || 'image.jpg', size: file.size, mimeType: file.type || 'image/jpeg' })), useCloud)
      } else {
        const result = await Taro.chooseVideo({ sourceType: ['album', 'camera'] })
        if (!isCurrent(['system:attachment:create'])) return
        await upload([{ path: result.tempFilePath, name: result.tempFilePath.split('/').pop() || 'video.mp4', size: result.size, mimeType: 'video/mp4' }], useCloud)
      }
    } catch (reason) {
      if (reason && typeof reason === 'object' && 'errMsg' in reason && String(reason.errMsg).includes('cancel')) return
      if (isCurrent()) setError(errorMessage(reason))
    }
  }
  const remove = async (folder?: AttachmentFolder) => {
    if (!access.current.remove || !isCurrent(['system:attachment:delete']) || locked.current || (!folder && !selected.length)) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      if (!await confirmAction({ title: folder ? '删除分组' : '批量删除素材', content: folder ? `确认删除「${folder.name}」？包含子分组或素材的分组不能删除。` : `确认删除已选择的 ${selected.length} 个素材？` }) || !access.current.remove || !isCurrent(['system:attachment:delete'])) return
      if (folder) {
        await deleteFolder(folder.id)
        if (!isCurrent(['system:attachment:delete'])) return
        if (Number(list.filters.folderId) === folder.id) list.setFilters({ folderId: '0' })
        refreshFolders()
      } else { await batchDeleteAttachments(selected); if (!isCurrent(['system:attachment:delete'])) return; refresh() }
      await Taro.showToast({ title: '已删除', icon: 'success' })
    } catch (reason) { if (isCurrent()) setError(errorMessage(reason)) }
    finally { locked.current = false; if (isCurrent()) setBusy(false) }
  }
  const importLinks = async () => {
    if (!access.current.create || !isCurrent(['system:attachment:create']) || locked.current) return
    const urls = links.split(/\s+/).map((value) => value.trim()).filter(Boolean)
    if (!urls.length || urls.length > 20 || urls.some((url) => !/^https?:\/\//i.test(url))) { setError('请输入 1–20 个 HTTP 或 HTTPS 图片链接，每行一个'); return }
    locked.current = true
    setBusy(true)
    setError('')
    try {
      await importImages(urls, Number(list.filters.folderId) || undefined)
      if (!isCurrent(['system:attachment:create'])) return
      setLinks(''); setShowImport(false); refresh()
      await Taro.showToast({ title: '导入成功', icon: 'success' })
    } catch (reason) { if (isCurrent()) setError(errorMessage(reason)) }
    finally { locked.current = false; if (isCurrent()) setBusy(false) }
  }
  const flatFolders: AttachmentFolder[] = []
  const flatten = (nodes: AttachmentFolder[]) => { for (const node of nodes) { flatFolders.push(node); flatten(node.children || []) } }
  flatten(folders)
  if (!guard.ready || !guard.allowed) return <AdminPage title="媒体库">{null}</AdminPage>
  return <AdminPage title="媒体库">
    <View className="admin-card">
      <FormField type="input" label="搜索素材" value={list.keyword} onInput={list.setKeyword} />
      <AdminSelect label="分组" value={String(list.filters.folderId || '0')} options={folderOptions(folders).map((option) => option.value === '0' ? { ...option, label: '全部分组' } : option)} onChange={(folderId) => list.setFilters({ folderId })} />
      <AdminSelect label="素材类型" value={String(list.filters.kind || 'all')} options={kindOptions} onChange={(kind) => list.setFilters({ kind })} />
      <AdminSelect label="状态" value={String(list.filters.status || '')} options={[{ label: '全部', value: '' }, { label: '启用', value: '1' }, { label: '禁用', value: '0' }]} onChange={(status) => list.setFilters({ status })} />
      <View className="admin-actions"><Button size="sm" variant="secondary" disabled={busy} onClick={refresh}>刷新</Button><Button size="sm" variant="secondary" onClick={() => setShowFolders(!showFolders)}>管理分组</Button></View>
      {canCreate && <>
        <Text className="admin-section-title">上传到当前分组</Text>
        <View className="admin-actions"><Button size="sm" disabled={busy} onClick={() => choose('image')}>选择图片</Button><Button size="sm" disabled={busy} onClick={() => choose('video')}>选择视频</Button><FileUpload disabled={busy} onFiles={upload} onError={(reason) => setError(errorMessage(reason))} /><Button size="sm" variant="secondary" disabled={busy} onClick={() => setShowImport(!showImport)}>链接导入</Button></View>
        {cloud?.provider === 'qiniu' && canCloudUpload && <View className="admin-actions"><Button size="sm" disabled={busy} onClick={() => choose('image', true)}>七牛云图片上传</Button><FileUpload label="七牛云文件上传" disabled={busy} onFiles={(files) => upload(files, true)} onError={(reason) => setError(errorMessage(reason))} /></View>}
        <AdminNotice>普通上传保存到本地存储。图片链接导入每次最多 20 个。</AdminNotice>
      </>}
      {showImport && canCreate && <><FormField type="textarea" label="图片链接（每行一个）" value={links} disabled={busy} maxLength={-1} onInput={setLinks} /><Button loading={busy} onClick={importLinks}>导入到当前分组</Button></>}
    </View>
    {notice && <AdminNotice>{notice}</AdminNotice>}
    {error && <AdminNotice>{error}</AdminNotice>}
    {foldersError && <StateView kind="error" text={`分组加载失败：${foldersError}`} onRetry={() => setFolderRevision(folderRevision + 1)} />}
    {showFolders && <View className="admin-card">
      <Text className="admin-section-title">素材分组</Text><FolderForm folders={folders} onSaved={refreshFolders} />
      {foldersLoading ? <StateView kind="loading" /> : flatFolders.map((folder) => <View key={folder.id} className="admin-row"><View><Text className="admin-name">{folder.name}</Text><Text className="admin-meta">{folder.kind} · {folder.status === '1' ? '启用' : '禁用'} · 排序 {folder.sort_order}</Text><FolderForm folder={folder} folders={folders} onSaved={refreshFolders} />{canDelete && <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(folder)}>删除分组</Button>}</View></View>)}
    </View>}
    <Text className="admin-section-title">素材 · {list.total} 个</Text>
    {selected.length > 0 && canDelete && <View className="admin-actions"><Button size="sm" variant="danger" loading={busy} onClick={() => remove()}>删除已选 {selected.length} 项</Button><Button size="sm" variant="secondary" onClick={() => setSelected([])}>取消选择</Button></View>}
    {list.loading && !list.list.length ? <StateView kind="loading" /> : list.error ? <StateView kind="error" text={list.error} onRetry={list.refresh} /> : !list.list.length ? <StateView kind="empty" text="暂无素材" /> : list.list.map((item) => <AttachmentCard key={item.id} item={item} folders={folders} domain={cloud?.domain} selected={selected.includes(item.id)} onSelect={() => setSelected((values) => values.includes(item.id) ? values.filter((id) => id !== item.id) : [...values, item.id])} onSaved={refresh} />)}
    {!list.finished && list.list.length > 0 && <Button variant="secondary" loading={list.loadingMore} onClick={list.loadMore}>加载更多</Button>}
  </AdminPage>
}

export default withAccountScope(AttachmentsPage)
