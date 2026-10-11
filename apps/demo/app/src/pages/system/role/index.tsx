import { useDidShow } from '@tarojs/taro'
import * as adminRoleApi from '@/api/admin/role'
import type { AdminRole, AdminRoleListQuery } from '@/api/admin/types'
import { Tag } from '@/components/atoms'
import {
  ManagementCell,
  ManagementFilterBar,
  ManagementFilterTabs,
  ManagementHeaderAction,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
} from '@/components/management'
import { PERMS, SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite, useListPagination } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '../_shared/AdminUI'
import { DATA_SCOPE_LABELS, roleStatus, roleTypeLabel } from './model'

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

function RolePage() {
  const guard = useRequireAuth({ moduleId: 'system-role' })
  const canCreate = useCanWrite(PERMS.roleCreate, PERMS.roleGrant)

  const {
    list,
    total,
    loading,
    refreshing,
    loadingMore,
    finished,
    error,
    keyword,
    filters,
    setKeyword,
    setFilters,
    refresh,
  } = useListPagination<AdminRole>({
    enabled: guard.ready && guard.allowed,
    fetcher: async ({ page, pageSize, keyword: kw, filters: fs }) => {
      const query: AdminRoleListQuery = {
        page,
        pageSize,
        keyword: kw || undefined,
        status: (fs.status as '0' | '1' | undefined) || undefined,
      }
      const { data, pagination } = await adminRoleApi.listAdminRoles(query)
      return { list: data, total: pagination.total }
    },
  })

  useDidShow(() => {
    if (guard.ready && guard.allowed) void refresh()
  })

  if (!guard.ready || !guard.allowed) return <ManagementPage className="page-container">{null}</ManagementPage>

  const kind: 'loading' | 'error' | 'empty' | 'ready' = error
    ? 'error'
    : loading && list.length === 0
      ? 'loading'
      : list.length === 0
        ? 'empty'
        : 'ready'

  return (
    <ManagementPage className="page-container">
      <ManagementPageHeader
        title="角色管理"
        subtitle={`${total} 个角色`}
        action={
          canCreate ? (
            <ManagementHeaderAction
              label="新建"
              onClick={() => navigateTo(`/${SYSTEM_PAGES.roleForm}`)}
            />
          ) : undefined
        }
      />

      <ManagementFilterBar>
        <ManagementSearchBar value={keyword} onChange={setKeyword} placeholder="搜索角色" />
        <ManagementFilterTabs
          tabs={STATUS_TABS}
          active={(filters.status as string | undefined) ?? ''}
          onChange={(status) => setFilters({ status })}
        />
      </ManagementFilterBar>

      <ManagementStates
        kind={kind}
        emptyText={keyword ? '未找到相关角色' : '暂无角色'}
        errorText="加载失败，请重试"
        onRetry={refresh}
      >
        <ManagementList>
          {list.map((role, index) => {
            const status = roleStatus(role)
            return (
              <ManagementCell
                key={role.id}
                bordered={index < list.length - 1}
                glyph="shield"
                glyphColor={role.isSystemDefault ? '#1677FF' : '#4E5969'}
                title={role.name}
                tag={
                  <Tag size="sm" variant={status.variant}>
                    {status.label}
                  </Tag>
                }
                description={`${roleTypeLabel(role)} · ${DATA_SCOPE_LABELS[role.dataScope] ?? '未设置数据权限'}`}
                footnote={role.description || '暂无描述'}
                onClick={() => navigateTo(`/${SYSTEM_PAGES.roleDetail}?id=${role.id}`)}
              />
            )
          })}
        </ManagementList>
      </ManagementStates>

      <ManagementListFooter
        loadingMore={loadingMore}
        refreshing={refreshing}
        finished={finished}
        empty={list.length === 0}
        summary={kind === 'ready' ? `共 ${total} 个角色` : undefined}
      />
    </ManagementPage>
  )
}

export default withAccountScope(RolePage)
