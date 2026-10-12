import { deleteTodo, type TodoInput } from '@/api/demo'
import { getSessionVersion } from '@/api/client'
import type { TagVariant } from '@/components/atoms'
import { confirmAction } from '@/hooks'
import { canWriteModuleNow } from '@/utils/auth-guard'

/** 数组下标即后端状态码：渲染文案、提交下标。 */
export const TODO_STATUS_LABELS = ['待办', '进行中', '已完成'] as const
const TODO_STATUS_VARIANTS: readonly TagVariant[] = ['default', 'primary', 'success']

export function todoStatusLabel(status: number): string {
  return TODO_STATUS_LABELS[status] ?? '未知'
}

export function todoStatusVariant(status: number): TagVariant {
  return TODO_STATUS_VARIANTS[status] ?? 'default'
}

export interface TodoFormValues {
  title: string
  description: string
  status: string
  /** 截止时间开关：关闭即清除截止时间（编辑时提交 dueAt: null） */
  hasDue: boolean
  date: string
  time: string
}

/** 北京时间的今天（YYYY-MM-DD），打开截止时间开关时作为默认日期。 */
export function todayDate(now: number = Date.now()): string {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

export function todoPayload(values: TodoFormValues, editing: boolean): TodoInput {
  const title = values.title.trim()
  if (!title || title.length > 200) throw new Error('请输入 1–200 字的标题')
  if (values.description.length > 2000) throw new Error('描述不能超过 2000 字')
  const status = Number(values.status)
  if (status !== 0 && status !== 1 && status !== 2) throw new Error('请选择有效状态')
  const data: TodoInput = { title, description: values.description, status }
  if (!values.hasDue) {
    if (editing) data.dueAt = null
    return data
  }
  if (!values.date) throw new Error('请选择截止日期')
  const value = `${values.date}T${values.time || '00:00'}:00+08:00`
  const date = new Date(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time || '00:00') || !Number.isFinite(date.getTime())) throw new Error('请选择有效的截止时间')
  const local = new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
  if (local !== values.date) throw new Error('请选择有效的截止时间')
  data.dueAt = date.toISOString()
  return data
}

export function todoFormValues(todo?: { title: string; description: string; status: number; dueAt: string | null }): TodoFormValues {
  const local = todo?.dueAt ? new Date(new Date(todo.dueAt).getTime() + 8 * 3600 * 1000).toISOString() : ''
  return {
    title: todo?.title ?? '',
    description: todo?.description ?? '',
    status: String(todo?.status ?? 0),
    hasDue: Boolean(local),
    date: local.slice(0, 10),
    time: local.slice(11, 16) || '09:00',
  }
}

export async function removeTodo(
  todo: { id: number; title: string },
  active: () => boolean = () => true,
): Promise<boolean> {
  const required = ['demo:todos:delete']
  const session = getSessionVersion()
  const current = () =>
    active() && session === getSessionVersion() && canWriteModuleNow('demo-todos', required)
  if (!current()) return false
  if (
    !(await confirmAction({
      content: `确定删除 Todo“${todo.title}”？`,
      confirmColor: '#F53F3F',
    })) ||
    !current()
  )
    return false
  await deleteTodo(todo.id)
  return current()
}
