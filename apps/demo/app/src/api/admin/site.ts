import { request } from '../client'

export const siteFields = [
  ['siteName', '站点名称'], ['siteDomain', '站点域名'], ['siteTitle', '站点标题'],
  ['siteLogo', 'LOGO 地址'], ['siteFavicon', 'Favicon 地址'], ['seoKeywords', 'SEO 关键词'],
  ['seoDescription', 'SEO 描述'], ['icp', 'ICP备案号'], ['publicSecurityIcp', '公安备案号'],
  ['contactEmail', '联系邮箱'], ['contactPhone', '联系电话'], ['contactAddress', '联系地址'], ['footerHtml', '页脚内容'],
] as const
export type SiteConfig = Record<typeof siteFields[number][0], string>

export function emptySiteConfig(): SiteConfig {
  return { siteName: '', siteDomain: '', siteTitle: '', siteLogo: '', siteFavicon: '', seoKeywords: '', seoDescription: '', icp: '', publicSecurityIcp: '', contactEmail: '', contactPhone: '', contactAddress: '', footerHtml: '' }
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const value = await request<string | null>({ path: '/api/v1/admin/system/options/basicConfig' })
  if (!value) return emptySiteConfig()
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object') throw new Error('站点配置格式错误')
  const result = emptySiteConfig()
  for (const [key] of siteFields) {
    if (key in parsed) {
      const field = (parsed as Record<string, unknown>)[key]
      if (typeof field === 'string') result[key] = field
    }
  }
  return result
}

export async function saveSiteConfig(config: SiteConfig) {
  const response = await request<{ updatedCount: number; results: { key: string; success: boolean; message?: string }[] }>({
    method: 'POST', path: '/api/v1/admin/system/options/batch', data: [{ key: 'basicConfig', value: JSON.stringify(config) }],
  })
  const saved = response.results.find((item) => item.key === 'basicConfig')
  if (!saved?.success) throw new Error(saved?.message || '站点配置保存失败')
}
