import { request } from '../client'

export type StorageProvider = 'disabled' | 'qiniu' | 'aliyunOss'
export interface QiniuConfig {
  accessKey?: string; secretKey?: string; bucket?: string; region?: string; domain?: string
  uploadHost?: string; useHttps?: boolean; useCdnDomains?: boolean; tokenExpires?: number; callbackUrl?: string
}
export interface OssConfig {
  accessKeyId?: string; accessKeySecret?: string; bucket?: string; region?: string; endpoint?: string; domain?: string; useHttps?: boolean
}
export interface StorageConfig { provider: StorageProvider; qiniu: QiniuConfig; aliyunOss: OssConfig }
export interface StorageExport extends StorageConfig { format: string; version: number; exportedAt: string }

export function sanitizeStorageConfig<T extends StorageConfig>(config: T): T {
  const { secretKey: _qiniuSecret, ...qiniu } = config.qiniu || {}
  const { accessKeySecret: _ossSecret, ...aliyunOss } = config.aliyunOss || {}
  return { ...config, qiniu, aliyunOss }
}

export function storageSavePayload(config: StorageConfig) {
  if (config.provider === 'qiniu') {
    const { secretKey, ...fields } = config.qiniu
    return { provider: config.provider, qiniu: { ...fields, ...(secretKey?.trim() ? { secretKey: secretKey.trim() } : {}) } }
  }
  if (config.provider === 'aliyunOss') {
    const { accessKeySecret, ...fields } = config.aliyunOss
    return { provider: config.provider, aliyunOss: { ...fields, ...(accessKeySecret?.trim() ? { accessKeySecret: accessKeySecret.trim() } : {}) } }
  }
  return { provider: config.provider }
}
export async function getStorageConfig() {
  return sanitizeStorageConfig(await request<StorageConfig>({ path: '/api/v1/admin/system/storage/config' }))
}
export async function saveStorageConfig(config: StorageConfig) {
  return sanitizeStorageConfig(await request<StorageConfig>({ method: 'PUT', path: '/api/v1/admin/system/storage/config', data: storageSavePayload(config) }))
}
export async function exportStorageConfig() {
  return sanitizeStorageConfig(await request<StorageExport>({ path: '/api/v1/admin/system/storage/export' }))
}
export function importStorageConfig(config: StorageConfig) {
  return request<{ provider: StorageProvider }>({ method: 'POST', path: '/api/v1/admin/system/storage/import', data: storageSavePayload(config) })
}

export function parseStorageImport(text: string): StorageConfig {
  const input: unknown = JSON.parse(text)
  if (!input || typeof input !== 'object') throw new Error('配置必须是 JSON 对象')
  const source = input as Record<string, unknown>
  const provider = source.provider
  if (provider !== 'disabled' && provider !== 'qiniu' && provider !== 'aliyunOss') throw new Error('存储服务商不正确')
  const q = source.qiniu && typeof source.qiniu === 'object' ? source.qiniu as Record<string, unknown> : {}
  const a = source.aliyunOss && typeof source.aliyunOss === 'object' ? source.aliyunOss as Record<string, unknown> : {}
  const stringField = (record: Record<string, unknown>, key: string) => typeof record[key] === 'string' ? record[key] as string : undefined
  const booleanField = (record: Record<string, unknown>, key: string) => typeof record[key] === 'boolean' ? record[key] as boolean : undefined
  return { provider, qiniu: {
    accessKey: stringField(q, 'accessKey'), secretKey: stringField(q, 'secretKey'), bucket: stringField(q, 'bucket'), region: stringField(q, 'region'),
    domain: stringField(q, 'domain'), uploadHost: stringField(q, 'uploadHost'), callbackUrl: stringField(q, 'callbackUrl'),
    useHttps: booleanField(q, 'useHttps'), useCdnDomains: booleanField(q, 'useCdnDomains'), tokenExpires: typeof q.tokenExpires === 'number' ? q.tokenExpires : undefined,
  }, aliyunOss: {
    accessKeyId: stringField(a, 'accessKeyId'), accessKeySecret: stringField(a, 'accessKeySecret'), bucket: stringField(a, 'bucket'), region: stringField(a, 'region'),
    endpoint: stringField(a, 'endpoint'), domain: stringField(a, 'domain'), useHttps: booleanField(a, 'useHttps'),
  } }
}
