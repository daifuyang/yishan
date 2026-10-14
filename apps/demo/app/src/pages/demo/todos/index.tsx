import { PageContainer } from '@/components/layout'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { listTodos, type DemoTodo } from '@/api/demo'
import { Tag } from '@/components/atoms'
import {
  BottomSelectSheet,
  ManagementCell,
  ManagementFilterBar,
  ManagementFilterClear,
  ManagementFilterTriggers,
  ManagementHeaderAction,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
} from '@/components/management'
import { DEMO_PAGES } from '@/constants/routes'
import { useCanWrite, useListPagination } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '@/utils/account-scope'
import {
  buildTodoQuery,
  DEFAULT_TODO_FILTERS,
  readTodoFilters,
  TODO_STATUS_OPTIONS,
  type TodoFilters,
} from './filters'
import { todoStatusLabel, todoStatusVariant } from './model'

/** 单行描述：描述优先，其次截止时间，不拼接多个属性。 */
function todoDescription(todo: DemoTodo): string {
  if (todo.description) return todo.description
  if (todo.dueAt) return `截止 ${formatDateTime(todo.dueAt)}`
  return '暂无描述'
}

function TodosPage() {
  const guard = useRequireAuth({ moduleId: 'demo-todos' })
  const canCreate = useCanWrite('demo:todos:create')
  const [panel, setPanel] = useState<string | null>(null)
  const list = useListPagination({
    enabled: guard.ready && guard.allowed,
    initialFilters: { ...DEFAULT_TODO_FILTERS },
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const result = await listTodos(
        buildTodoQuery(page, pageSize, keyword, readTodoFilters(filters)),
      )
      return { list: result.items, total: result.total }
    },
  })
  const todoFilters = readTodoFilters(list.filters)
  const filtered = Boolean(list.keyword || todoFilters.status)
  const changeFilters = (patch: Partial<TodoFilters>) => {
    list.setFilters(patch)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const clearFilters = () => {
    list.setKeyword('')
    changeFilters({ ...DEFAULT_TODO_FILTERS })
  }
  useDidShow(() => {
    if (guard.ready && guard.allowed) void list.refresh()
  })
  useDidHide(() => setPanel(null))
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>
  const kind = list.error
    ? 'error'
    : list.loading && !list.list.length
      ? 'loading'
      : !list.list.length
        ? 'empty'
        : 'ready'
  // 触发器上单写「全部」看不出筛的是什么维度，未筛选时显示「全部状态」
  const statusLabel = todoFilters.status
    ? (TODO_STATUS_OPTIONS.find((option) => option.key === todoFilters.status)?.label ??
      '全部状态')
    : '全部状态'
  const pageAction = canCreate ? (
    <ManagementHeaderAction
      label="新建"
      onClick={() => navigateTo(`/${DEMO_PAGES.todoForm}`)}
    />
  ) : undefined

  return (
    <ManagementPage
      bottomActions={process.env.TARO_ENV === 'h5' ? pageAction : undefined}
    >
      <ManagementPageHeader
        title="Todo 示例"
        action={pageAction}
      />
      <ManagementFilterBar>
        <ManagementSearchBar
          value={list.keyword}
          onChange={list.setKeyword}
          placeholder="搜索标题或描述"
        />
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : key)}
          triggers={[{ key: 'status', label: statusLabel, active: Boolean(todoFilters.status) }]}
        />
      </ManagementFilterBar>
      <BottomSelectSheet
        open={panel === 'status'}
        title="Todo 状态"
        options={TODO_STATUS_OPTIONS}
        value={todoFilters.status}
        onSelect={(key) => changeFilters({ status: key })}
        onClose={() => setPanel(null)}
      />
      {kind === 'empty' && filtered ? <ManagementFilterClear onClick={clearFilters} /> : null}
      <ManagementStates
        kind={kind}
        errorText={list.error || undefined}
        emptyText={filtered ? '未找到符合条件的 Todo' : '暂无 Todo'}
        onRetry={list.refresh}
      >
        <ManagementList>
          {list.list.map((todo, index) => (
            <ManagementCell
              key={todo.id}
              bordered={index < list.list.length - 1}
              glyph="check"
              title={todo.title}
              description={todoDescription(todo)}
              tag={
                <Tag size="sm" variant={todoStatusVariant(todo.status)}>
                  {todoStatusLabel(todo.status)}
                </Tag>
              }
              onClick={() => navigateTo(`/${DEMO_PAGES.todoDetail}?id=${todo.id}`)}
            />
          ))}
        </ManagementList>
      </ManagementStates>
      <ManagementListFooter
        loadingMore={list.loadingMore}
        refreshing={list.refreshing}
        finished={list.finished}
        empty={!list.list.length}
        summary={kind === 'ready' ? `共 ${list.total} 项` : undefined}
      />
    </ManagementPage>
  )
}
export default withAccountScope(TodosPage)
