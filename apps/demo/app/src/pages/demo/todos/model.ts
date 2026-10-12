import type { TodoInput } from '@/api/demo'

export interface TodoFormValues { title: string; description: string; status: string; date: string; time: string }

export function todoPayload(values: TodoFormValues, editing: boolean): TodoInput {
  const title = values.title.trim()
  if (!title || title.length > 200) throw new Error('请输入 1–200 字的标题')
  if (values.description.length > 2000) throw new Error('描述不能超过 2000 字')
  const status = Number(values.status)
  if (status !== 0 && status !== 1 && status !== 2) throw new Error('请选择有效状态')
  const data: TodoInput = { title, description: values.description, status }
  if (!values.date) {
    if (editing) data.dueAt = null
    return data
  }
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
  return { title: todo?.title ?? '', description: todo?.description ?? '', status: String(todo?.status ?? 0), date: local.slice(0, 10), time: local.slice(11, 16) || '09:00' }
}
