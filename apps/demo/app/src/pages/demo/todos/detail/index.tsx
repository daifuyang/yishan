import { PageContainer } from '@/components/layout'
import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { getTodo, type DemoTodo } from '@/api/demo'
import { getSessionVersion } from '@/api/client'
import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  BottomActionBar,
  type BottomAction,
  DetailContent,
  DetailHero,
  DetailRow,
  DetailSection,
  ManagementPage,
  ManagementPageHeader,
} from '@/components/management'
import { DEMO_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '@/utils/account-scope'
import { removeTodo, todoStatusLabel, todoStatusVariant } from '../model'

function TodoDetailPage() {
  const guard = useRequireAuth({ moduleId: 'demo-todos' })
  const id = Number(useRouter().params.id)
  const canUpdate = useCanWrite('demo:todos:update')
  const canDelete = useCanWrite('demo:todos:delete')
  const [todo, setTodo] = useState<DemoTodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false)
  const mounted = useRef(true)
  const sequence = useRef(0)
  const locked = useRef(false)
  const refreshOnShow = useRef(false)
  async function load() {
    if (!guard.ready || !guard.allowed || locked.current) return
    const current = ++sequence.current
    const session = getSessionVersion()
    const active = () =>
      mounted.current && current === sequence.current && session === getSessionVersion()
    setLoading(true)
    setError('')
    try {
      if (!Number.isInteger(id) || id <= 0) throw new Error('Todo ID 缺失或无效')
      const data = await getTodo(id)
      if (active()) setTodo(data)
    } catch (cause) {
      if (active()) setError(errorMessage(cause))
    } finally {
      if (active()) setLoading(false)
    }
  }
  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
      sequence.current++
    }
  }, [id, guard.ready, guard.allowed])
  useDidHide(() => {
    refreshOnShow.current = true
    setMore(false)
  })
  useDidShow(() => {
    if (refreshOnShow.current) {
      refreshOnShow.current = false
      void load()
    }
  })
  async function remove() {
    const permission = 'demo:todos:delete'
    if (!todo || locked.current || loading || !canWriteModuleNow('demo-todos', [permission])) return
    const session = getSessionVersion()
    const active = () =>
      mounted.current &&
      session === getSessionVersion() &&
      canWriteModuleNow('demo-todos', [permission])
    locked.current = true
    setBusy(true)
    setMore(false)
    try {
      if (await removeTodo(todo, active)) {
        void Taro.showToast({ title: '已删除', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active()) void Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>
  const actions: BottomAction[] = [
    ...(canUpdate
      ? [
          {
            key: 'edit',
            label: '编辑',
            icon: 'pencil' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${DEMO_PAGES.todoForm}?id=${id}`),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            key: 'more',
            label: '更多',
            icon: 'moreVertical' as const,
            tone: 'muted' as const,
            onClick: () => setMore(true),
          },
        ]
      : []),
  ]
  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="Todo 详情" /> : null}
      <DetailContent>
        <StateView
          kind={error ? 'error' : loading && !todo ? 'loading' : !todo ? 'empty' : 'ready'}
          text={error || undefined}
          onRetry={load}
        >
          {todo ? (
            <>
              <DetailHero
                glyph="check"
                title={todo.title}
                tag={<Tag variant={todoStatusVariant(todo.status)}>{todoStatusLabel(todo.status)}</Tag>}
              />
              <DetailSection title="基本信息">
                <DetailRow label="标题" value={todo.title} />
                <DetailRow label="状态" value={todoStatusLabel(todo.status)} />
                <DetailRow
                  label="截止时间"
                  value={todo.dueAt ? formatDateTime(todo.dueAt) : '未设置'}
                />
                <DetailRow label="描述" value={todo.description} multiline />
              </DetailSection>
              <DetailSection title="记录" collapsible defaultCollapsed>
                <DetailRow label="ID" value={todo.id} />
                <DetailRow label="创建时间" value={formatDateTime(todo.createdAt)} />
                <DetailRow label="更新时间" value={formatDateTime(todo.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
      {todo ? (
        <BottomActionBar actions={actions} disabled={busy || loading || Boolean(error)} />
      ) : null}
      <ActionSheet
        open={more}
        items={[
          {
            key: 'delete',
            label: '删除 Todo',
            icon: 'trash',
            danger: true,
            onClick: () => void remove(),
          },
        ]}
        onClose={() => setMore(false)}
      />
    </ManagementPage>
  )
}
export default withAccountScope(TodoDetailPage)
