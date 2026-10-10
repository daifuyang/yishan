/* =============================================================
 * Icon names — SVG icon component names
 * SVG icons are stored in src/components/icons/svg/
 * ============================================================= */

export const ICONS = {
  search: 'search',
  home: 'home',
  apps: 'apps',
  user: 'user',
  bell: 'bell',
  settings: 'settings',
  arrowRight: 'arrowRight',
  chevronRight: 'chevronRight',
  check: 'check',
  close: 'close',
  plus: '+',
  minus: '−',
  star: '★',
  heart: '♡',
  calendar: '▤',
  document: '◫',
  folder: '◰',
  mail: '✉',
  phone: '☎',
  location: '◉',
  image: '▣',
  download: '↓',
  upload: '↑',
  qrcode: '▥',
  cart: '◧',
  shop: '◫',
  order: '▥',
  coupon: '%',
  favorite: '♡',
  service: '☎',
  feedback: '✎',
  about: 'ⓘ',
  logout: '→',
  message: '✉',
  scan: '⌖',
  more: '⋯',
  filter: '⌕',
  sort: '⇅',
  edit: '✎',
  delete: '✕',
} as const

/**
 * IconFont 类名 — SVG 图标组件名
 * 当前已支持：home, apps, user, bell, settings, arrowRight, chevronRight, check, close, search
 */
export const ICONFONT_NAMES = {
  home: 'home',
  apps: 'apps',
  user: 'user',
  bell: 'bell',
  settings: 'settings',
  arrowRight: 'arrowRight',
  chevronRight: 'chevronRight',
  check: 'check',
  close: 'close',
  search: 'search',
} as const

export type IconName = keyof typeof ICONS
export type IconFontName = keyof typeof ICONFONT_NAMES
