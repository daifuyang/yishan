import type { LineIconName } from './LineIcon'

/**
 * 菜单资源的三种语义：目录 / 页面 / 操作。
 *
 * 用语义名而不是后端的 0/1/2，是因为「按钮」只是前端的实现方式 ——
 * 权限模型里它是一类可执行动作，叫「操作」才不会让人以为是 UI 控件。
 *
 * 这里只放纯数据，不 import React / Taro：筛选器、表单这类纯逻辑模块也要用同一份
 * 文案，从组件文件里拿就得把整套 UI 依赖拖进来。
 */
export type MenuResourceType = 'directory' | 'page' | 'action'

/** 后端 sys_menu.type（0/1/2）→ UI 语义类型。 */
export function menuResourceType(type: number): MenuResourceType {
  return type === 0 ? 'directory' : type === 2 ? 'action' : 'page'
}

/**
 * Settings / Zap / Shield 自带「配置 / 自动化 / 安全策略」的业务含义，
 * 会盖过「操作权限」本身，所以操作类型用指针点击而不是齿轮。
 */
export const MENU_RESOURCE_ICONS: Record<MenuResourceType, LineIconName> = {
  directory: 'folder',
  page: 'fileText',
  action: 'mousePointerClick',
}

export const MENU_RESOURCE_LABELS: Record<MenuResourceType, string> = {
  directory: '目录',
  page: '页面',
  action: '操作',
}

/** 目录与页面用主色系强调，操作是叶子动作，用灰色弱化 —— 视觉层级与业务层级一致。 */
export const MENU_RESOURCE_COLORS: Record<MenuResourceType, string> = {
  directory: '#1677FF',
  page: '#1677FF',
  action: '#86909C',
}

export function menuTypeLabel(type: MenuResourceType): string {
  return MENU_RESOURCE_LABELS[type]
}
