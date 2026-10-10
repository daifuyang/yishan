/**
 * 菜单 icon 名称 → ICONS 字符映射
 * 约定：后端 SysMenu.icon 字段使用小写英文关键词（与 ICONS key 对齐）
 * 匹配不上时回退首字母方案（见 apps/index.tsx 的 renderIcon）
 */
import { ICONS } from '@/components/icons/icons'

export type IconGlyph = keyof typeof ICONS

const MENU_ICON_MAP: Record<string, IconGlyph> = {
  system: 'settings',
  setting: 'settings',
  settings: 'settings',
  user: 'user',
  users: 'user',
  role: 'user',
  department: 'folder',
  dept: 'folder',
  post: 'document',
  menu: 'apps',
  dict: 'document',
  site: 'settings',
  storage: 'folder',
  attachment: 'image',
  attachments: 'image',
  media: 'image',
  plugin: 'apps',
  plugins: 'apps',
  app: 'apps',
  apps: 'apps',
  home: 'home',
  contact: 'phone',
  contacts: 'phone',
  profile: 'user',
  password: 'settings',
  loginLog: 'document',
  loginlog: 'document',
  log: 'document',
  notify: 'bell',
  notification: 'bell',
  message: 'mail',
  search: 'search',
  scan: 'scan',
  qrcode: 'qrcode',
  about: 'about',
  feedback: 'feedback',
  favorite: 'favorite',
  star: 'star',
  calendar: 'calendar',
  document: 'document',
  folder: 'folder',
  file: 'document',
  image: 'image',
  mail: 'mail',
  phone: 'phone',
  location: 'location',
  order: 'order',
  cart: 'cart',
  coupon: 'coupon',
}

/**
 * 把后端菜单的 icon 字符串映射到 ICONS 字符
 *  - 命中映射表 → 返回 ICONS[icon]
 *  - 单字符 → 原样返回
 *  - 多字符 / 未匹配 → 返回 null（让调用方走首字母兜底）
 */
export function mapMenuIcon(name?: string | null): string | null {
  if (!name) return null
  const key = name.toLowerCase().trim()
  const glyph = MENU_ICON_MAP[key]
  if (glyph) return ICONS[glyph]
  if (key.length === 1) return key
  return null
}

/** 兜底：取首字母大写 */
export function fallbackIconChar(name?: string | null): string {
  if (!name) return '·'
  return name.trim().charAt(0).toUpperCase() || '·'
}
