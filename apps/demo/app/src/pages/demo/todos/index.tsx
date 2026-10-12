import { useEffect, useRef, useState } from 'react'
import { Picker, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Button } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback'
import { createTodo, deleteTodo, listTodos, updateTodo, type DemoTodo } from '@/api/demo'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { getSessionVersion } from '@/api/client'
import { AdminNotice, AdminPage, AdminSelect, errorMessage } from '../../system/_shared/AdminUI'
import { todoFormValues, todoPayload } from './model'
import { useAuthStore } from '@/stores/auth'

const STATUS = [{ value: '0', label: '待办' }, { value: '1', label: '进行中' }, { value: '2', label: '已完成' }]

function TodoEditor({ todo, onClose, onSaved }: { todo: DemoTodo | null; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState(() => todoFormValues(todo ?? undefined))
  const initial = useRef(JSON.stringify(values))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const locked = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const canSave = useCanWrite(todo ? 'demo:todos:update' : 'demo:todos:create')
  const guard = useRequireAuth({ moduleId: 'demo-todos' })
  const set = (patch: Partial<typeof values>) => setValues((previous) => ({ ...previous, ...patch }))
  const close = async () => {
    if (locked.current) return
    if (JSON.stringify(values) !== initial.current) {
      const result = await Taro.showModal({ title: '放弃修改', content: '尚未保存的修改将丢失，是否退出？', confirmText: '放弃修改' })
      if (!result.confirm) return
    }
    onClose()
  }
  const save = async () => {
    const required = [todo ? 'demo:todos:update' : 'demo:todos:create']
    if (locked.current || !canSave || !guard.allowed || !canWriteModuleNow('demo-todos', required)) return
    const version = getSessionVersion()
    const current = () => alive.current && version === getSessionVersion() && canWriteModuleNow('demo-todos', required)
    setError('')
    try {
      const data = todoPayload(values, Boolean(todo))
      locked.current = true
      setSaving(true)
      if (todo) await updateTodo(todo.id, data)
      else await createTodo({ ...data, dueAt: data.dueAt ?? undefined })
      if (!current()) return
      await Taro.showToast({ title: '保存成功', icon: 'success' })
      if (current()) onSaved()
    } catch (cause) { if (current()) setError(errorMessage(cause)) }
    finally { locked.current = false; if (alive.current) setSaving(false) }
  }
  return <View className="admin-card">
    <Text className="admin-section-title">{todo ? '编辑 Todo' : '新建 Todo'}</Text>
    <FormField type="input" label="标题" required value={values.title} maxLength={200} disabled={saving} onInput={(title) => set({ title })} />
    <FormField type="textarea" label="描述" value={values.description} maxLength={2000} disabled={saving} onInput={(description) => set({ description })} />
    <AdminSelect label="状态" value={values.status} options={STATUS} disabled={saving} onChange={(status) => set({ status })} />
    <Picker mode="date" value={values.date} disabled={saving} onChange={(event) => set({ date: event.detail.value })}><FormField type="picker" label="截止日期" value={values.date} placeholder="不设置" /></Picker>
    {values.date ? <><Picker mode="time" value={values.time} disabled={saving} onChange={(event) => set({ time: event.detail.value })}><FormField type="picker" label="截止时间（北京时间）" value={values.time} /></Picker><Button variant="text" disabled={saving} onClick={() => set({ date: '' })}>清除截止时间</Button></> : null}
    {error ? <AdminNotice>{error}</AdminNotice> : null}
    <View className="admin-actions"><Button disabled={!canSave || saving} loading={saving} onClick={save}>保存</Button><Button variant="secondary" disabled={saving} onClick={close}>取消</Button></View>
  </View>
}

export default function TodosPage() {
  const guard = useRequireAuth({ moduleId: 'demo-todos' })
  const identity = useAuthStore((state) => state.user?.id)
  return guard.allowed ? <TodosContent key={identity} /> : <AdminPage title="Todo 示例">{null}</AdminPage>
}

function TodosContent() {
  const guard = useRequireAuth({ moduleId: 'demo-todos' })
  const canCreate = useCanWrite('demo:todos:create')
  const canUpdate = useCanWrite('demo:todos:update')
  const canDelete = useCanWrite('demo:todos:delete')
  const [todos, setTodos] = useState<DemoTodo[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<DemoTodo | null | undefined>(undefined)
  const [detail, setDetail] = useState<DemoTodo | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const generation = useRef(0)
  const allowed = useRef(guard.allowed)
  allowed.current = guard.allowed
  const load = async () => {
    if (!allowed.current) return
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      const result = await listTodos()
      if (current !== generation.current || !allowed.current) return
      setTodos(result.items)
      setLoaded(true)
      setDetail((previous) => previous ? result.items.find((item) => item.id === previous.id) ?? null : null)
    } catch (cause) { if (current === generation.current && allowed.current) setError(errorMessage(cause)) }
    finally { if (current === generation.current) setLoading(false) }
  }
  useEffect(() => {
    if (guard.allowed) void load()
    else { setTodos([]); setLoaded(false); setEditing(undefined); setDetail(null) }
    return () => { generation.current++ }
  }, [guard.allowed])
  useDidShow(() => { if (loaded) void load() })
  usePullDownRefresh(async () => { try { await load() } finally { Taro.stopPullDownRefresh() } })
  const remove = async (todo: DemoTodo) => {
    if (lock.current || !canDelete || !guard.allowed) return
    lock.current = true
    const version = getSessionVersion()
    const currentGeneration = generation.current
    const current = () => currentGeneration === generation.current && version === getSessionVersion() && canWriteModuleNow('demo-todos', ['demo:todos:delete'])
    try {
      const result = await Taro.showModal({ title: '删除 Todo', content: `确定删除「${todo.title}」？删除后无法恢复。`, confirmText: '删除', confirmColor: '#d93025' })
      if (!result.confirm || !current()) return
      setBusy(true)
      await deleteTodo(todo.id)
      if (!current()) return
      await Taro.showToast({ title: '已删除', icon: 'success' })
      setDetail(null)
      await load()
    } catch (cause) { if (current()) setError(errorMessage(cause)) }
    finally { lock.current = false; setBusy(false) }
  }
  const list = todos.filter((todo) => (!status || String(todo.status) === status) && `${todo.title} ${todo.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <AdminPage title="Todo 示例" action={canCreate && editing === undefined ? <Button size="sm" disabled={busy} onClick={() => setEditing(null)}>新建</Button> : null}>
    {editing !== undefined ? <TodoEditor key={editing?.id ?? 'create'} todo={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); void load() }} /> : <>
      <FormField type="input" value={query} placeholder="搜索标题或描述" onInput={setQuery} />
      <AdminSelect label="状态" value={status} options={[{ value: '', label: '全部' }, ...STATUS]} onChange={setStatus} />
      <View className="admin-actions"><Button variant="secondary" disabled={loading} onClick={load}>刷新</Button></View>
      {error ? <ErrorState text={error} onRetry={load} /> : null}
      {loading && !loaded ? <LoadingState /> : null}
      {loaded && !list.length ? <EmptyState text={query || status ? '未找到符合条件的 Todo' : '暂无 Todo'} /> : null}
      <AdminNotice>共 {list.length} 项</AdminNotice>
      {detail ? <View className="admin-card"><Text className="admin-name">{detail.title}</Text><Text className="admin-meta">{detail.description || '暂无描述'}</Text><Text className="admin-meta">状态：{STATUS[detail.status]?.label}</Text><Text className="admin-meta">截止时间：{detail.dueAt ? new Date(detail.dueAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置'}</Text><Text className="admin-meta">创建时间：{detail.createdAt}</Text><Text className="admin-meta">更新时间：{detail.updatedAt}</Text><View className="admin-actions">{canUpdate ? <Button disabled={busy} onClick={() => setEditing(detail)}>编辑</Button> : null}{canDelete ? <Button variant="danger" disabled={busy} onClick={() => remove(detail)}>删除</Button> : null}<Button variant="secondary" onClick={() => setDetail(null)}>收起</Button></View></View> : null}
      {list.map((todo) => <View key={todo.id} className="admin-card"><View className="admin-row" onClick={() => setDetail(todo)}><View><Text className="admin-name">{todo.title}</Text><Text className="admin-meta">{STATUS[todo.status]?.label} · {todo.dueAt ? `截止 ${todo.dueAt.slice(0, 10)}` : '无截止日期'}</Text></View><Text>查看 ›</Text></View><View className="admin-actions">{canUpdate ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(todo)}>编辑</Button> : null}</View></View>)}
    </>}
  </AdminPage>
}
