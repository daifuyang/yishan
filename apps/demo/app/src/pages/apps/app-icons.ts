import { homeIconBackground, resolveHomeIcon } from '../index/home-icons'

// 工作台补充 Lucide 风格线性图标，沿用小程序兼容的 SVG 背景图方案。
const ICONS = {
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11"/><path d="m9 12 2 2 4-4"/>',
  briefcase:
    '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 12a20 20 0 0 0 20 0M12 12v4"/>',
  menu: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M13 8h4M13 12h4M13 16h4"/>',
  mapPin:
    '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  cloud: '<path d="M20 16.2A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 16.2M12 12v10m-4-6 4-4 4 4"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  folder:
    '<path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z"/>',
  fileText:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8M8 17h8"/>',
  files:
    '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',
  tag: '<path d="m20 13-7 7a2 2 0 0 1-3 0l-8-8V2h10l8 8a2 2 0 0 1 0 3Z"/><circle cx="7" cy="7" r="1"/>',
  package: '<path d="m12 3 9 5v8l-9 5-9-5V8Zm0 10 9-5M12 13 3 8M12 13v8M7.5 5.5l9 5"/>',
  barcode: '<path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14"/>',
  chart: '<path d="M3 3v18h18M7 14l4-4 4 3 6-7"/>',
  wallet:
    '<path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6M22 12h-6v5h6"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
} as const

const ALIASES: Record<string, keyof typeof ICONS> = {
  '/system/role': 'shield',
  '/system/position': 'briefcase',
  '/system/menu': 'menu',
  '/system/region': 'mapPin',
  '/system/storage': 'cloud',
  '/system/attachments': 'image',
  safety: 'shield',
  safetycertificate: 'shield',
  idcard: 'briefcase',
  profile: 'briefcase',
  menu: 'menu',
  environment: 'mapPin',
  global: 'mapPin',
  cloud: 'cloud',
  cloudupload: 'cloud',
  picture: 'image',
  folder: 'folder',
  file: 'fileText',
  filetext: 'fileText',
  solution: 'fileText',
  copy: 'files',
  snippets: 'files',
  tags: 'tag',
  tag: 'tag',
  box: 'package',
  shopping: 'package',
  shoppingcart: 'package',
  barcode: 'barcode',
  dashboard: 'chart',
  fund: 'chart',
  linechart: 'chart',
  dollar: 'wallet',
  paycircle: 'wallet',
  wallet: 'wallet',
  aim: 'target',
}

export function appIconBackground(icon: string): string {
  const key = icon.replace(/(Outlined|Filled|TwoTone)$/, '').toLowerCase()
  const name = ALIASES[key]
  if (!name) {
    const fallback = key === '/system/site' ? 'SettingOutlined' : icon
    return homeIconBackground(resolveHomeIcon(fallback), '#1677FF')
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1677FF" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
