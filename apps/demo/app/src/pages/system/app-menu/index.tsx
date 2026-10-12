import Taro, { useDidHide } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { getAdminAppMenuTree, type AdminAppMenu } from '@/api/admin/appMenu'
import {
  ManagementFilterBar,
  ManagementFilterClear,
  ManagementHeaderAction,
  MenuTree,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
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



function appMenuMatches(node: AdminAppMenu, needle: string): boolean {
  return `${node.name} ${node.page || ''} ${node.moduleId || ''}`.toLowerCase().includes(needle)
}

/** 分组才允许挂入口；筛选时若把分组滤掉，入口就成了看不见的孤儿。 */
function filterAppMenuTree(
  nodes: readonly AdminAppMenu[],
  type: string,
  status: string,
): AdminAppMenu[] {
  const keep = (node: AdminAppMenu): AdminAppMenu | null => {
    const children = (node.children ?? []).flatMap((child) => {
      const matched = keep(child)
      return matched ? [matched] : []
    })
    const typeOk = !type || String(node.type) === type
    const statusOk = !status || node.status === status
    if ((typeOk && statusOk) || children.length) return { ...node, children }
    return null
  }
  return nodes.flatMap((node) => {
    const matched = keep(node)
    return matched ? [matched] : []
  })
}

function AppMenuPage() {
  const guard = useRequireAuth({ moduleId: 'system-app-menu' })
  const canCreate = useCanWrite('system:app-menu:create')
  const [keyword, setKeyword] = useState('')
  const [tree, setTree] = useState<AdminAppMenu[]>([])
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  // 当前展开的一级分组。手风琴：一次只展开一个。
  const [openModuleId, setOpenModuleId] = useState<number | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const enabled = guard.ready && guard.allowed

  async function load() {
    if (!enabled) return
    setLoading(true)
    setError('')
    try {
      setTree(await getAdminAppMenuTree())
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
  useDidHide(() => undefined)

  const filtered = useMemo(
    () => filterAppMenuTree(searchTree(tree, appMenuMatches, keyword), type, status),
    [tree, keyword, type, status],
  )
  // 搜索/筛选时全展开，否则命中的深层节点藏在折叠态里看不见。
  const searching = Boolean(keyword || type || status)
  const expandedNow = searching ? collectExpandable(filtered) : expanded
  const visibleCount = useMemo(
    () => flattenTree(filtered, expandedNow).length,
    [filtered, expandedNow],
  )

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const kind = error ? 'error' : loading && !tree.length ? 'loading' : !tree.length ? 'empty' : 'ready'
  const active = Boolean(keyword || type || status)
  return (
    <ManagementPage>
      <ManagementPageHeader
        title="工作台管理"
        action={
          canCreate ? (
            <ManagementHeaderAction
              label="新建"
              onClick={() => navigateTo(`/${SYSTEM_PAGES.appMenuForm}`)}
            />
          ) : undefined
        }
      />
      <ManagementFilterBar>
        <ManagementSearchBar
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索名称、页面路径或模块"
        />
      </ManagementFilterBar>
      {kind === 'empty' && active ? (
        <ManagementFilterClear
          onClick={() => {
            setKeyword('')
            setType('')
            setStatus('')
            void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
          }}
        />
      ) : null}
      <ManagementStates
        kind={kind}
        errorText={error || undefined}
        emptyText={active ? '未找到符合条件的工作台菜单' : '暂无工作台菜单'}
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
            description: depth === 1 ? node.page || node.moduleId : undefined,
            // 分组沿用「目录」的视觉，入口沿用「页面」
            type: node.type === 0 ? 'directory' : 'page',
          })}
          onSelect={(node) => navigateTo(`/${SYSTEM_PAGES.appMenuDetail}?id=${node.id}`)}
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
export default withAccountScope(AppMenuPage)
