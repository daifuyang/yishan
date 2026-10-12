import type {
  AttachmentFolder,
  AttachmentKind,
  AttachmentQuery,
  FolderInput,
  UploadFile,
} from '@/api/admin/attachments'
import type { LineIconName } from '@/components/management'

export const KIND_LABELS: Record<AttachmentKind, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  other: '其他',
}

export const KIND_GLYPH: Record<AttachmentKind, LineIconName> = {
  image: 'image',
  video: 'video',
  audio: 'music',
  other: 'file',
}

export const KIND_OPTIONS = [
  { key: '', label: '全部类型' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'other', label: '其他' },
] as const

export const STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

/** 表单用的状态枚举（EnumField 取 value/label） */
export const STATUS_ENUM = [
  { value: '1', label: '启用' },
  { value: '0', label: '禁用' },
] as const

/** 分组的素材类型限制 */
export const FOLDER_KIND_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'other', label: '其他' },
] as const

export interface AttachmentFilters {
  folderId: number
  kind: '' | AttachmentKind
  status: '' | '0' | '1'
}

export const DEFAULT_ATTACHMENT_FILTERS: AttachmentFilters = { folderId: 0, kind: '', status: '' }

const KINDS: readonly AttachmentKind[] = ['image', 'video', 'audio', 'other']

/** useListPagination 的 filters 是弱类型字典，这里收敛成筛选对象。 */
export function readAttachmentFilters(filters: Record<string, unknown>): AttachmentFilters {
  const folderId = Number(filters.folderId)
  const kind = KINDS.find((item) => item === filters.kind) ?? ''
  const status = filters.status === '0' || filters.status === '1' ? filters.status : ''
  return { folderId: Number.isInteger(folderId) && folderId > 0 ? folderId : 0, kind, status }
}

export function buildAttachmentQuery(
  page: number,
  pageSize: number,
  keyword: string,
  filters: AttachmentFilters,
): AttachmentQuery {
  const query: AttachmentQuery = { page, pageSize }
  if (keyword.trim()) query.keyword = keyword.trim()
  if (filters.folderId) query.folderId = filters.folderId
  if (filters.kind) query.kind = filters.kind
  if (filters.status) query.status = filters.status
  return query
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const text = value >= 100 || unit === 0 ? String(Math.round(value)) : String(Number(value.toFixed(1)))
  return `${text} ${units[unit]}`
}

export function kindOfFile(file: UploadFile): AttachmentKind {
  if (file.mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)) return 'image'
  if (file.mimeType.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(file.name)) return 'video'
  if (file.mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) return 'audio'
  return 'other'
}

export function folderPath(folders: AttachmentFolder[], id: number): AttachmentFolder[] {
  for (const folder of folders) {
    if (folder.id === id) return [folder]
    const rest = folderPath(folder.children || [], id)
    if (rest.length) return [folder, ...rest]
  }
  return []
}

export function findFolder(folders: AttachmentFolder[], id: number): AttachmentFolder | undefined {
  const path = folderPath(folders, id)
  return path[path.length - 1]
}

export function folderLabel(folders: AttachmentFolder[], id: number | undefined, empty: string): string {
  if (!id) return empty
  return findFolder(folders, id)?.name ?? empty
}

/** 自身及全部后代 id，用于上级分组选择时防环 */
export function subtreeIds(folders: AttachmentFolder[], id: number): Set<number> {
  const ids = new Set<number>()
  const visit = (node: AttachmentFolder) => {
    ids.add(node.id)
    for (const child of node.children || []) visit(child)
  }
  const root = findFolder(folders, id)
  if (root) visit(root)
  return ids
}

/** 编辑素材只提交名称、分组、状态；metadata 不在移动端编辑，带上会覆盖后端的值。 */
export function attachmentEditPayload(name: string, folderId: number, status: '0' | '1') {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请输入素材名称')
  return { name: trimmed, folderId: folderId > 0 ? folderId : null, status }
}

export interface FolderFormValues {
  name: string
  parentId: number
  kind: 'all' | AttachmentKind
  status: '0' | '1'
  sort: string
  remark: string
}

export function folderPayload(values: FolderFormValues): FolderInput {
  const name = values.name.trim()
  if (!name) throw new Error('请输入分组名称')
  if (!/^\d+$/.test(values.sort.trim())) throw new Error('排序须为非负整数')
  return {
    name,
    parentId: values.parentId,
    kind: values.kind,
    status: values.status,
    sort_order: Number(values.sort.trim()),
    remark: values.remark.trim(),
  }
}

export function parseImportLinks(text: string): string[] {
  const urls = text.split(/\s+/).map((value) => value.trim()).filter(Boolean)
  if (!urls.length) throw new Error('请输入图片链接')
  if (urls.length > 20) throw new Error('每次最多导入 20 个链接')
  if (urls.some((url) => !/^https?:\/\//i.test(url))) throw new Error('只支持 HTTP 或 HTTPS 链接')
  return urls
}
