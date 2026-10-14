import Taro, { useDidHide } from '@tarojs/taro'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  BottomSelectSheet,
  ManagementFilterBar,
  ManagementFilterClear,
  ManagementFilterTriggers,
  ManagementHeaderAction,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
  MenuTree,
  type MenuResourceType,
  type Matches,
  type TreeNode,
  collectExpandable,
  flattenTree,
  searchTree,
  toggleExpanded,
} from '@/components/management'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { errorMessage } from '@/utils/account-scope'
import {
  DEFAULT_TREE_FILTERS,
  type FilterableNode,
  filterTreeByTypeStatus,
  TREE_STATUS_OPTIONS,
  type TreeFilterOption,
} from './menuTreeFilters'

/**
 * 菜单管理与工作台管理共用的「按模块分组的树形列表页」。
 *
 * 两个页面的交互必须一模一样：手风琴默认全部折叠、搜索/筛选时全展开、
 * 类型 + 状态两个筛选、底部按可见节点计数。各页面只提供数据、文案和节点渲染，
 * 不再各自维护一份页面骨架 —— 复制出来的两份迟早会长出不同的默认行为。
 */

export interface MenuTreeListPageProps<T extends FilterableNode & TreeNode<T>> {
  /** 页面标题，同时是空态文案里的名词 */
  title: string
  /** 空态/无结果文案里的资源名，如「菜单」「工作台菜单」 */
  noun: string
  moduleId: string
  createPermission: string
  searchPlaceholder: string
  typeOptions: readonly TreeFilterOption[]
  /** 类型筛选弹层标题 */
  typeTitle: string
  load: () => Promise<T[]>
  matches: Matches<T>
  renderNode: (node: T, depth: number) => {
    title: ReactNode
    description?: ReactNode
    type: MenuResourceType
  }
  createUrl: string
  detailUrl: (node: T) => string
}

export function MenuTreeListPage<T extends FilterableNode & TreeNode<T>>({
  title,
  noun,
  moduleId,
  createPermission,
  searchPlaceholder,
  typeOptions,
  typeTitle,
  load: fetchTree,
  matches,
  renderNode,
  createUrl,
  detailUrl,
}: MenuTreeListPageProps<T>) {
  const guard = useRequireAuth({ moduleId })
  const canCreate = useCanWrite(createPermission)
  const [panel, setPanel] = useState<'type' | 'status' | null>(null)
  const [keyword, setKeyword] = useState('')
  const [tree, setTree] = useState<T[]>([])
  const [filters, setFilters] = useState(DEFAULT_TREE_FILTERS)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  // 当前展开的一级模块。手风琴：一次只展开一个，默认全部折叠。
  const [openModuleId, setOpenModuleId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const enabled = guard.ready && guard.allowed

  async function load() {
    if (!enabled) return
    setLoading(true)
    setError('')
    try {
      setTree(await fetchTree())
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [enabled])
  useDidHide(() => setPanel(null))

  const filtered = useMemo(
    () => filterTreeByTypeStatus(searchTree(tree, matches, keyword), filters),
    [tree, keyword, filters],
  )
  // 搜索/筛选时全展开，否则命中的深层节点藏在折叠态里看不见。
  const active = Boolean(keyword || filters.type || filters.status)
  const expandedNow = useMemo(
    () => (active ? collectExpandable(filtered) : expanded),
    [active, filtered, expanded],
  )
  // 底部摘要报的是「可见节点数」而不是总数：折叠时用户看到的才是这个数。
  const visibleCount = useMemo(
    () => flattenTree(filtered, expandedNow).length,
    [filtered, expandedNow],
  )

  if (!enabled) return <ManagementPage>{null}</ManagementPage>
  const kind = error ? 'error' : loading && !tree.length ? 'loading' : !tree.length ? 'empty' : 'ready'
  const clearAll = () => {
    setKeyword('')
    setFilters(DEFAULT_TREE_FILTERS)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const typeLabel =
    typeOptions.find((option) => option.key === filters.type)?.label ?? typeOptions[0].label
  const statusLabel =
    TREE_STATUS_OPTIONS.find((option) => option.key === filters.status)?.label ??
    TREE_STATUS_OPTIONS[0].label
  const pageAction = canCreate ? (
    <ManagementHeaderAction label="新建" onClick={() => navigateTo(createUrl)} />
  ) : undefined

  return (
    <ManagementPage
      bottomActions={process.env.TARO_ENV === 'h5' ? pageAction : undefined}
    >
      <ManagementPageHeader
        title={title}
        action={pageAction}
      />
      <ManagementFilterBar>
        <ManagementSearchBar value={keyword} onChange={setKeyword} placeholder={searchPlaceholder} />
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : (key as 'type' | 'status'))}
          triggers={[
            { key: 'type', label: typeLabel, active: Boolean(filters.type) },
            { key: 'status', label: statusLabel, active: Boolean(filters.status) },
          ]}
        />
      </ManagementFilterBar>
      <BottomSelectSheet
        open={panel !== null}
        title={panel === 'type' ? typeTitle : `${noun}状态`}
        options={panel === 'type' ? typeOptions : TREE_STATUS_OPTIONS}
        value={panel === 'type' ? filters.type : filters.status}
        onSelect={(key) => setFilters({ ...filters, [panel === 'type' ? 'type' : 'status']: key })}
        onClose={() => setPanel(null)}
      />
      {kind === 'empty' && active ? <ManagementFilterClear onClick={clearAll} /> : null}
      <ManagementStates
        kind={kind}
        errorText={error || undefined}
        emptyText={active ? `未找到符合条件的${noun}` : `暂无${noun}`}
        onRetry={() => void load()}
      >
        <MenuTree
          tree={filtered}
          openModuleId={openModuleId}
          allOpen={active}
          onToggleModule={(id) => setOpenModuleId((current) => (current === id ? null : id))}
          expanded={expandedNow}
          onToggle={(id) => setExpanded((current) => toggleExpanded(current, id))}
          renderNode={renderNode}
          onSelect={(node) => navigateTo(detailUrl(node))}
        />
      </ManagementStates>
      <ManagementListFooter
        loadingMore={false}
        refreshing={false}
        finished
        empty={!visibleCount}
        summary={kind === 'ready' ? `共 ${visibleCount} 项` : undefined}
      />
    </ManagementPage>
  )
}
