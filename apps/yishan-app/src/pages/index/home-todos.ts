/**
 * 首页「我的待办」接入点。
 * 当前后端没有面向移动端的统一待办服务（CRM 任务 / demo todos 均无移动端页面可承接），
 * 因此来源列表为空，首页隐藏该模块；接入真实来源时在 HOME_TODO_SOURCES 登记即可。
 */
import type { HomeIconName } from './home-icons'

export type TodoPriority = 'urgent' | 'overdue' | 'normal'

export interface HomeTodoItem {
  id: string
  title: string
  /** 简短辅助信息，如截止时间、来源 */
  meta?: string
  priority: TodoPriority
  /** ISO 时间，用于同优先级排序 */
  dueAt?: string
  icon?: HomeIconName
  /** 真实事项页面（不带前导斜杠的页面路径，可含 query） */
  entry: string
}

export interface HomeTodoSource {
  id: string
  /** 访问该来源所需权限 */
  permission: string
  /** 「全部」入口；没有真实列表页时不提供 */
  listEntry?: string
  load: () => Promise<HomeTodoItem[]>
}

export const HOME_TODO_SOURCES: readonly HomeTodoSource[] = []

export const MAX_HOME_TODOS = 3

export function getVisibleTodoSources(
  permissions?: readonly string[],
  sources: readonly HomeTodoSource[] = HOME_TODO_SOURCES,
): HomeTodoSource[] {
  if (!permissions) return []
  return sources.filter((source) => permissions.includes(source.permission))
}

const PRIORITY_RANK: Record<TodoPriority, number> = { urgent: 0, overdue: 1, normal: 2 }

/** 立即处理 > 逾期/临期 > 普通；同级按截止时间升序 */
export function pickTopTodos(items: readonly HomeTodoItem[], limit = MAX_HOME_TODOS): HomeTodoItem[] {
  const due = (item: HomeTodoItem) => (item.dueAt ? Date.parse(item.dueAt) : Number.POSITIVE_INFINITY)
  return [...items]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || due(a) - due(b))
    .slice(0, limit)
}
