import type { OssConfig, QiniuConfig, StorageConfig, StorageProvider } from '@/api/admin/storage'
import type { LineIconName } from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'

export type CloudProvider = Exclude<StorageProvider, 'disabled'>

export const PROVIDER_OPTIONS: readonly { value: StorageProvider; label: string }[] = [
  { value: 'disabled', label: '不启用' },
  { value: 'qiniu', label: '七牛云' },
  { value: 'aliyunOss', label: '阿里云 OSS' },
]

/** 七牛存储区域编码，与后端 qiniuRegion 枚举一致 */
export const QINIU_REGIONS = [
  { value: 'z0', label: '华东' },
  { value: 'z1', label: '华北' },
  { value: 'z2', label: '华南' },
  { value: 'na0', label: '北美' },
  { value: 'as0', label: '东南亚' },
] as const

export const QINIU_DEFAULTS = { region: 'z0', useHttps: true, useCdnDomains: true, tokenExpires: 3600 } as const

export function providerLabel(provider: StorageProvider): string {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider
}

export function regionLabel(config: StorageConfig): string {
  if (config.provider === 'qiniu') {
    const region = config.qiniu.region || QINIU_DEFAULTS.region
    return QINIU_REGIONS.find((item) => item.value === region)?.label ?? region
  }
  return config.provider === 'aliyunOss' ? config.aliyunOss.region || '' : ''
}

/** 当前服务商的公共字段（bucket / 域名 / HTTPS），概览与各分类页按服务商取值时共用。 */
export function activeCloud(config: StorageConfig): { bucket: string; domain: string; useHttps: boolean } {
  if (config.provider === 'qiniu')
    return { bucket: config.qiniu.bucket || '', domain: config.qiniu.domain || '', useHttps: config.qiniu.useHttps ?? true }
  if (config.provider === 'aliyunOss')
    return { bucket: config.aliyunOss.bucket || '', domain: config.aliyunOss.domain || '', useHttps: config.aliyunOss.useHttps ?? true }
  return { bucket: '', domain: '', useHttps: true }
}

type QiniuField = keyof QiniuConfig
type OssField = keyof OssConfig

export interface StorageSection {
  key: 'basic' | 'access' | 'upload'
  title: string
  description: string
  glyph: LineIconName
  page: string
  /** 只对这些服务商展示该分类 */
  providers: readonly StorageProvider[]
  /** 该分类页负责的字段：保存时只提交这些，其余字段由服务端沿用已存值 */
  fields: { qiniu: readonly QiniuField[]; aliyunOss: readonly OssField[] }
}

/**
 * PC 端是一张随服务商切换字段的大表单；移动端按「连得上 / 怎么访问 / 怎么上传」拆成分类页。
 * 字段全部来自现有的 qiniuConfig / aliyunOssConfig，不新增数据。
 */
export const STORAGE_SECTIONS: readonly StorageSection[] = [
  {
    key: 'basic',
    title: '基础配置',
    description: '服务商、空间、访问密钥',
    glyph: 'cloud',
    page: SYSTEM_PAGES.storageBasic,
    providers: ['disabled', 'qiniu', 'aliyunOss'],
    fields: {
      qiniu: ['accessKey', 'secretKey', 'bucket', 'region'],
      aliyunOss: ['accessKeyId', 'accessKeySecret', 'bucket', 'region', 'endpoint'],
    },
  },
  {
    key: 'access',
    title: '访问配置',
    description: 'CDN 域名、HTTPS',
    glyph: 'globe',
    page: SYSTEM_PAGES.storageAccess,
    providers: ['qiniu', 'aliyunOss'],
    fields: { qiniu: ['domain', 'useHttps', 'useCdnDomains'], aliyunOss: ['domain', 'useHttps'] },
  },
  {
    key: 'upload',
    title: '上传设置',
    description: '上传地址、凭证有效期、回调地址',
    glyph: 'upload',
    page: SYSTEM_PAGES.storageUpload,
    providers: ['qiniu'],
    fields: { qiniu: ['uploadHost', 'tokenExpires', 'callbackUrl'], aliyunOss: [] },
  },
]

export function sectionOf(key: StorageSection['key']): StorageSection {
  const section = STORAGE_SECTIONS.find((item) => item.key === key)
  if (!section) throw new Error(`未知云存储配置分类：${key}`)
  return section
}

/** 只保留本页负责的字段，服务端按「已存配置 + 本次字段」合并。 */
export function sectionPayload(config: StorageConfig, section: StorageSection): StorageConfig {
  const pick = <T extends object>(source: T, fields: readonly (keyof T)[]) =>
    Object.fromEntries(fields.map((field) => [field, source[field]])) as Partial<T>
  return {
    provider: config.provider,
    qiniu: config.provider === 'qiniu' ? pick(config.qiniu, section.fields.qiniu) : {},
    aliyunOss: config.provider === 'aliyunOss' ? pick(config.aliyunOss, section.fields.aliyunOss) : {},
  }
}

/** 与 PC / 后端同一套必填规则；密钥是否已存只有服务端知道，留给服务端校验。 */
export function validateStorage(config: StorageConfig): string {
  if (config.provider === 'qiniu') {
    const { accessKey, bucket, region, tokenExpires } = config.qiniu
    if (!accessKey?.trim()) return '请输入 AccessKey'
    if (!bucket?.trim()) return '请输入 Bucket'
    if (!QINIU_REGIONS.some((item) => item.value === (region || QINIU_DEFAULTS.region))) return '请选择存储区域'
    if (tokenExpires !== undefined && (!Number.isInteger(tokenExpires) || tokenExpires < 60 || tokenExpires > 86400))
      return '凭证有效期须为 60–86400 秒的整数'
  }
  if (config.provider === 'aliyunOss') {
    const { accessKeyId, bucket, region } = config.aliyunOss
    if (!accessKeyId?.trim()) return '请输入 AccessKeyId'
    if (!bucket?.trim()) return '请输入 Bucket'
    if (!region?.trim()) return '请输入存储区域'
  }
  return ''
}
