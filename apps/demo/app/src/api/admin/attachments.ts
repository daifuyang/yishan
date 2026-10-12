import Taro from '@tarojs/taro'
import { request, requestPaginated, getSessionVersion } from '../client'
import { API_BASE_URL } from '@/config'
import { storage, STORAGE_KEYS } from '@/utils/storage'

export type AttachmentKind = 'image' | 'audio' | 'video' | 'other'
export interface Attachment {
  id: number; name?: string; originalName: string; filename: string; kind: AttachmentKind; folderId?: number; folderName?: string
  mimeType: string; size: number; storage: string; path?: string; url?: string; objectKey?: string; status: '0' | '1'
  width?: number; height?: number; duration?: number; metadata?: unknown; creatorName?: string; createdAt: string; updatedAt: string
}
export interface AttachmentFolder {
  id: number; name: string; parentId?: number; kind: 'all' | AttachmentKind; status: '0' | '1'; sort_order: number; remark?: string
  createdAt: string; updatedAt: string; children?: AttachmentFolder[]
}
export interface FolderInput { name: string; parentId?: number; kind: 'all' | AttachmentKind; status: '0' | '1'; sort_order: number; remark?: string }
export interface AttachmentQuery { page: number; pageSize: number; keyword?: string; kind?: AttachmentKind; folderId?: number; status?: '0' | '1' }
export interface AttachmentUpdate { name?: string; folderId?: number | null; status?: '0' | '1'; metadata?: unknown }
export interface UploadFile { path: string; name: string; size: number; mimeType: string }
export interface UploadResult { id?: number; originalName: string; filename: string; mimeType: string; size: number; path: string; url?: string }
export interface CloudUploadConfig { provider: string; domain?: string }
const base = '/api/v1/admin/attachments'

export function listAttachments(query: AttachmentQuery) { return requestPaginated<Attachment[]>({ path: `${base}/`, query: { ...query } }) }
export function getAttachment(id: number) { return request<Attachment>({ path: `${base}/${id}` }) }
export function updateAttachment(id: number, data: AttachmentUpdate) { return request<Attachment>({ method: 'PUT', path: `${base}/${id}`, data }) }
export function deleteAttachment(id: number) { return request<{ id: number }>({ method: 'DELETE', path: `${base}/${id}` }) }
export function batchDeleteAttachments(ids: number[]) { return request<{ ids: number[] }>({ method: 'DELETE', path: `${base}/`, data: { ids } }) }
export function getFolderTree() { return request<AttachmentFolder[]>({ path: `${base}/folders/tree` }) }
export function getFolder(id: number) { return request<AttachmentFolder>({ path: `${base}/folders/${id}` }) }
export function createFolder(data: FolderInput) { return request<AttachmentFolder>({ method: 'POST', path: `${base}/folders`, data }) }
export function updateFolder(id: number, data: FolderInput) { return request<AttachmentFolder>({ method: 'PUT', path: `${base}/folders/${id}`, data }) }
export function deleteFolder(id: number) { return request<{ id: number }>({ method: 'DELETE', path: `${base}/folders/${id}` }) }
export function importImages(urls: string[], folderId?: number) { return request<UploadResult[]>({ method: 'POST', path: `${base}/import`, data: { urls, folderId } }) }

export function folderOptions(nodes: Pick<AttachmentFolder, 'id' | 'name' | 'children'>[], excludeId?: number) {
  const result = [{ label: '未分组', value: '0' }]
  const visit = (items: Pick<AttachmentFolder, 'id' | 'name' | 'children'>[], prefix: string) => {
    for (const item of items) {
      if (item.id === excludeId) continue
      const label = `${prefix}${item.name}`
      result.push({ label, value: String(item.id) })
      visit(item.children || [], `${label} / `)
    }
  }
  visit(nodes, '')
  return result
}

export function attachmentUrl(item: Pick<Attachment, 'url' | 'path' | 'objectKey' | 'storage'>, domain?: string) {
  const value = (item.url || item.path || item.objectKey || '').trim()
  if (!value || /^[a-z][\w+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  if (item.storage === 'qiniu') {
    if (!domain) return ''
    const host = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`
    return `${host.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`
  }
  return `${API_BASE_URL.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`
}

export async function getCloudUploadConfig(): Promise<CloudUploadConfig> {
  const mode = await request<string | null>({ path: '/api/v1/admin/system/options/systemStorage' })
  if (mode !== '1') return { provider: mode === '2' ? 'aliyunOss' : 'disabled' }
  const raw = await request<string | null>({ path: '/api/v1/admin/system/options/qiniuConfig' })
  const input: unknown = raw ? JSON.parse(raw) : {}
  const domain = input && typeof input === 'object' && 'domain' in input && typeof input.domain === 'string' ? input.domain : undefined
  return { provider: 'qiniu', domain }
}

export async function uploadAttachment(file: UploadFile, params: { folderId?: number; kind?: AttachmentKind }, cloud?: CloudUploadConfig) {
  const session = getSessionVersion()
  const checkSession = () => { if (getSessionVersion() !== session) throw new Error('会话已改变，请重新上传') }
  // A normal authenticated request owns refresh/logout before starting multipart transport.
  await request({ path: '/api/v1/app/auth/me' })
  checkSession()
  if (cloud?.provider === 'qiniu') {
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
    const objectKey = `attachments/${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
    const token = await request<{ token: string; uploadUrl?: string }>({ path: '/api/v1/admin/system/qiniu/token', query: { scopeKey: objectKey } })
    checkSession()
    const response = await Taro.uploadFile({ url: token.uploadUrl || 'https://upload.qiniup.com', filePath: file.path, fileName: file.name, name: 'file', formData: { token: token.token, key: objectKey } })
    checkSession()
    const result: unknown = JSON.parse(response.data)
    if (response.statusCode < 200 || response.statusCode >= 300 || !result || typeof result !== 'object' || !('key' in result) || typeof result.key !== 'string' || !result.key) throw new Error('七牛云上传失败')
    const key = result.key
    const hash = 'hash' in result && typeof result.hash === 'string' ? result.hash : undefined
    return request<UploadResult[]>({ method: 'POST', path: `${base}/cloud`, data: { storage: 'qiniu', objectKey: key, originalName: file.name, mimeType: file.mimeType, size: file.size, hash, ...params } })
  }
  const query = Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')
  const send = () => Taro.uploadFile({ url: `${API_BASE_URL.replace(/\/+$/, '')}${base}/${query ? `?${query}` : ''}`, filePath: file.path, fileName: file.name, name: 'file', header: { Authorization: `Bearer ${storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN) || ''}` } })
  let response = await send()
  checkSession()
  const parse = (text: string): unknown => { try { return JSON.parse(text) } catch { return null } }
  let input = parse(response.data)
  if (response.statusCode === 401 || input && typeof input === 'object' && 'code' in input && [401, 401000, 401001, 401003, 22001, 22003, 22004, 22005, 22006, 22009].includes(Number(input.code))) {
    await request({ path: '/api/v1/app/auth/me' })
    checkSession()
    response = await send()
    checkSession()
    input = parse(response.data)
  }
  if (!input || typeof input !== 'object' || !('success' in input) || input.success !== true || response.statusCode < 200 || response.statusCode >= 300 || !('data' in input) || !Array.isArray(input.data)) {
    const message = input && typeof input === 'object' && 'message' in input && typeof input.message === 'string' ? input.message : '上传失败，请重试'
    throw new Error(message)
  }
  return input.data as UploadResult[]
}
