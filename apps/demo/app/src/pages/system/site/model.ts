import type { SiteConfig } from '@/api/admin/site'
import type { LineIconName } from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'

export type SiteField = keyof SiteConfig

export interface SiteSection {
  key: 'basic' | 'seo' | 'filing'
  title: string
  description: string
  glyph: LineIconName
  page: string
  /** 该分类页负责的字段：保存时只合并这些，其余字段以服务端最新值为准 */
  fields: readonly SiteField[]
}

/**
 * 移动端把 PC 的单张大表单拆成按用途分组的分类页。数据仍是同一份 basicConfig，
 * 分组只决定「哪一页编辑哪些字段」，不改变数据模型。
 */
export const SITE_SECTIONS: readonly SiteSection[] = [
  {
    key: 'basic',
    title: '基础信息',
    description: '站点名称、Logo、联系方式',
    glyph: 'building',
    page: SYSTEM_PAGES.siteBasic,
    fields: ['siteLogo', 'siteName', 'siteDomain', 'siteFavicon', 'contactPhone', 'contactEmail', 'contactAddress'],
  },
  {
    key: 'seo',
    title: 'SEO 优化',
    description: '标题、关键词、描述',
    glyph: 'search',
    page: SYSTEM_PAGES.siteSeo,
    fields: ['siteTitle', 'seoKeywords', 'seoDescription'],
  },
  {
    key: 'filing',
    title: '备案与页脚',
    description: 'ICP 备案、公安备案、页脚内容',
    glyph: 'shield',
    page: SYSTEM_PAGES.siteFiling,
    fields: ['icp', 'publicSecurityIcp', 'footerHtml'],
  },
]

export function sectionOf(key: SiteSection['key']): SiteSection {
  const section = SITE_SECTIONS.find((item) => item.key === key)
  if (!section) throw new Error(`未知站点配置分类：${key}`)
  return section
}

export function pickFields(config: SiteConfig, fields: readonly SiteField[]): Partial<SiteConfig> {
  return Object.fromEntries(fields.map((field) => [field, config[field]]))
}

/** PC 约定关键词以英文逗号分隔；移动端输入时也接受中文逗号与换行，去空去重。 */
export function parseKeywords(text: string): string[] {
  const result: string[] = []
  for (const part of text.split(/[,，\n]/)) {
    const keyword = part.trim()
    if (keyword && !result.includes(keyword)) result.push(keyword)
  }
  return result
}

export function joinKeywords(keywords: readonly string[]): string {
  return keywords.join(',')
}

/** 展示用域名：去掉协议与末尾斜杠，`https://example.com/` → `example.com`。 */
export function displayDomain(domain: string): string {
  return domain.trim().replace(/^[a-z][\w+.-]*:\/\//i, '').replace(/\/+$/, '')
}

/** 只有绝对地址才能在移动端直接加载；站点内相对路径（/assets/logo.png）属于前台站点，回退为首字头像。 */
export function previewImage(url: string): string | undefined {
  const value = url.trim()
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  return undefined
}
