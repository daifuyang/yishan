import Taro, { useDidHide } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { getAdminMenuTree, type AdminMenu } from '@/api/admin/menu'
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
  menuResourceType,
  collectExpandable,
  flattenTree,
  searchTree,
  toggleExpanded,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../_shared/AdminUI'
import {
  DEFAULT_MENU_FILTERS,
  filterMenuTree,
  menuMatches,
  MENU_STATUS_OPTIONS,
  MENU_TYPE_OPTIONS,
} from './filters'

function MenuPage() {
  const guard = useRequireAuth({ moduleId: 'system-menu' })
  const canCreate = useCanWrite('system:menu:create')
  const [panel, setPanel] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [tree, setTree] = useState<AdminMenu[]>([])
  const [filters, setFilters] = useState(DEFAULT_MENU_FILTERS)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  // 当前展开的一级模块。手风琴：一次只展开一个，其余默认折叠。
  const [openModuleId, setOpenModuleId] = useState<number | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const enabled = guard.ready && guard.allowed

  async function load(mode: 'initial' | 'refresh' = 'initial') {
    if (!enabled) return
    if (mode === 'refresh') setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      setTree(await getAdminMenuTree())
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  useEffect(() => {
    void load()
  }, [enabled])
  useDidHide(() => setPanel(null))

  const filtered = useMemo(
    () => filterMenuTree(searchTree(tree, menuMatches, keyword), filters),
    [tree, keyword, filters],
  )
  // 搜索/筛选时全展开，否则命中的深层节点藏在折叠态里看不见。
  const searching = Boolean(keyword || filters.type || filters.status)
  const expandedNow = searching ? collectExpandable(filtered) : expanded
  // 底部摘要报的是「可见节点数」而不是总菜单数：折叠时用户看到的才是这个数。
  const visibleCount = useMemo(
    () => flattenTree(filtered, expandedNow).length,
    [filtered, expandedNow],
  )

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const kind = error ? 'error' : loading && !tree.length ? 'loading' : !tree.length ? 'empty' : 'ready'
  const active = Boolean(keyword || filters.type || filters.status)
  const clearAll = () => {
    setKeyword('')
    setFilters(DEFAULT_MENU_FILTERS)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const typeLabel =
    MENU_TYPE_OPTIONS.find((option) => option.key === filters.type)?.label ?? MENU_TYPE_OPTIONS[0].label
  const statusLabel =
    MENU_STATUS_OPTIONS.find((option) => option.key === filters.status)?.label ??
    MENU_STATUS_OPTIONS[0].label
  return (
    <ManagementPage>
      <ManagementPageHeader
        title="菜单管理"
        action={
          canCreate ? (
            <ManagementHeaderAction
              label="新建"
              onClick={() => navigateTo(`/${SYSTEM_PAGES.menuForm}`)}
            />
          ) : undefined
        }
      />
      <ManagementFilterBar>
        <ManagementSearchBar
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索菜单名称、路由或组件"
        />
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : key)}
          triggers={[
            { key: 'type', label: typeLabel, active: Boolean(filters.type) },
            { key: 'status', label: statusLabel, active: Boolean(filters.status) },
          ]}
        />
      </ManagementFilterBar>
      <BottomSelectSheet
        open={panel === 'type' || panel === 'status'}
        title={panel === 'type' ? '菜单类型' : '菜单状态'}
        options={panel === 'type' ? MENU_TYPE_OPTIONS : MENU_STATUS_OPTIONS}
        value={panel === 'type' ? filters.type : filters.status}
        onSelect={(key) => setFilters({ ...filters, [panel === 'type' ? 'type' : 'status']: key })}
        onClose={() => setPanel(null)}
      />
      {kind === 'empty' && active ? <ManagementFilterClear onClick={clearAll} /> : null}
      <ManagementStates
        kind={kind}
        errorText={error || undefined}
        emptyText={active ? '未找到符合条件的菜单' : '暂无菜单'}
        onRetry={() => void load()}
      >
        <MenuTree
          tree={filtered}
          openModuleId={
            searching ? null : openModuleId !== undefined ? openModuleId : (filtered[0]?.id ?? null)
          }
          onToggleModule={(id) => setOpenModuleId((current) => (current === id ? null : id))}
          expanded={searching ? collectExpandable(filtered) : expanded}
          onToggle={(id) => setExpanded((current) => toggleExpanded(current, id))}
          renderNode={(node, depth) => ({
            title: node.name,
            // 页面显示路由，按钮显示权限标识；模块头不显示任何次要信息
            description:
              depth === 1
                ? node.path || node.component || '未设置路由'
                : depth >= 2
                  ? node.permissionCodes?.[0]
                  : undefined,
            type: menuResourceType(node.type),
          })}
          onSelect={(node) => navigateTo(`/${SYSTEM_PAGES.menuDetail}?id=${node.id}`)}
        />
      </ManagementStates>
      <ManagementListFooter
        loadingMore={false}
        refreshing={refreshing}
        finished
        empty={!visibleCount}
        summary={kind === 'ready' ? `共 ${visibleCount} 项` : undefined}
      />
    </ManagementPage>
  )
}
export default withAccountScope(MenuPage)
