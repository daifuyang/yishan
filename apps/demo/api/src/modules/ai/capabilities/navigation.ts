/**
 * navigation.ts — `navigate_to_page` 能力（由 ai 模块注册，不是 system 域）。
 *
 * 路由**只从白名单里取**，模型给的是白名单的键而不是完整 URL。
 * 这不是「顺手校验一下」：如果模型能输出任意 path，它就能把用户骗到
 * `/user/login?redirect=` 之类的页面上，而模型拿不到权限去判断那条路由是否该给他看。
 */
import { Type } from '@sinclair/typebox'
import { registerAiCapabilities, type AiCapability, type AiCapabilityContext, type AiCapabilityResult } from '@yishan/core-api/ai-capabilities/catalog'
import { AI_PERMISSION } from '../schemas/ai-chat.schema.js'

/** 白名单：键是模型可见的短名，值是真实后台路由。新增页面必须显式登记。 */
export const NAVIGATE_TARGETS = {
  user_list: { path: '/system/user', label: '用户管理' },
  role_list: { path: '/system/role', label: '角色管理' },
  department_list: { path: '/system/department', label: '部门管理' },
  position_list: { path: '/system/position', label: '岗位管理' },
  menu_list: { path: '/system/menu', label: '菜单管理' },
  dict_list: { path: '/system/dict', label: '字典管理' },
} as const

export type NavigateTargetKey = keyof typeof NAVIGATE_TARGETS

export const NavigateInputSchema = Type.Object({
  target: Type.Union(
    Object.keys(NAVIGATE_TARGETS).map(key => Type.Literal(key)) as never,
    { description: `可跳转的页面：${Object.entries(NAVIGATE_TARGETS).map(([key, value]) => `${key}（${value.label}）`).join('、')}` },
  ),
}, { additionalProperties: false })

export const navigateToPage: AiCapability = {
  name: 'navigate_to_page',
  description: '把用户带到一个后台管理页面。只支持固定的几张列表页，不能跳到任意地址，也不能代替用户操作页面。',
  moduleId: 'ai',
  operationId: 'aiNavigateToPage',
  // 导航本身不读写业务数据，但仍然受 AI 助手使用权限约束：没有 ai:chat:use
  // 的人不该通过模型触发界面跳转。
  permissionCode: AI_PERMISSION.code,
  inputSchema: NavigateInputSchema,
  riskLevel: 'prepare',
  enabled: true,
  async execute(_context: AiCapabilityContext, input: unknown): Promise<AiCapabilityResult> {
    const target = (input as { target?: string }).target
    const resolved = NAVIGATE_TARGETS[target as NavigateTargetKey]
    if (!resolved) throw new Error('不支持的跳转目标')
    const data = { target, path: resolved.path, label: resolved.label }
    return {
      data,
      render: { kind: 'navigate', payload: data },
      summary: `已为你打开「${resolved.label}」。`,
      mutated: false,
    }
  },
}

export function registerAiNavigationCapability(): void {
  registerAiCapabilities(navigateToPage)
}
