import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import * as adminRoleApi from '@/api/admin/role'
import type { AdminRole } from '@/api/admin/types'
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
import { PERMS, SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite, useListPagination } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '../_shared/AdminUI'
import {
  buildRoleQuery,
  DEFAULT_ROLE_FILTERS,
  readRoleFilters,
  ROLE_SORT_OPTIONS,
  ROLE_STATUS_OPTIONS,
  type RoleFilters,
} from './filters'
import { roleStatus } from './model'

function RolePage() {
  const guard = useRequireAuth({ moduleId: 'system-role' })
  const canCreate = useCanWrite(PERMS.roleCreate, PERMS.roleGrant)
  const [panel, setPanel] = useState<string | null>(null)

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
    initialFilters: { ...DEFAULT_ROLE_FILTERS },
    fetcher: async ({ page, pageSize, keyword: kw, filters: fs }) => {
      const { data, pagination } = await adminRoleApi.listAdminRoles(
        buildRoleQuery(page, pageSize, kw, readRoleFilters(fs)),
      )
      return { list: data, total: pagination.total }
    },
  })

  const roleFilters = readRoleFilters(filters)
  const filtered = Boolean(keyword || roleFilters.status)
  const changeFilters = (patch: Partial<RoleFilters>) => {
    setFilters(patch)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const clearFilters = () => {
    setKeyword('')
    changeFilters({ ...DEFAULT_ROLE_FILTERS })
  }

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

  const statusLabel =
    ROLE_STATUS_OPTIONS.find((option) => option.key === roleFilters.status)?.label ??
    ROLE_STATUS_OPTIONS[0].label
  const sortLabel =
    ROLE_SORT_OPTIONS.find((option) => option.key === roleFilters.sort)?.label ??
    ROLE_SORT_OPTIONS[0].label

  return (
    <ManagementPage className="page-container">
      <ManagementPageHeader
        title="角色管理"
        subtitle={filtered ? `找到 ${total} 个角色` : `${total} 个角色`}
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
        <ManagementSearchBar value={keyword} onChange={setKeyword} placeholder="搜索角色名称或描述" />
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : key)}
          triggers={[
            { key: 'status', label: statusLabel, active: Boolean(roleFilters.status) },
            {
              key: 'sort',
              label: sortLabel,
              active: roleFilters.sort !== DEFAULT_ROLE_FILTERS.sort,
            },
          ]}
        />
      </ManagementFilterBar>
      <BottomSelectSheet
        open={panel === 'status' || panel === 'sort'}
        title={panel === 'status' ? '角色状态' : '排序方式'}
        options={panel === 'status' ? ROLE_STATUS_OPTIONS : ROLE_SORT_OPTIONS}
        value={panel === 'status' ? roleFilters.status : roleFilters.sort}
        onSelect={(key) =>
          changeFilters(panel === 'status' ? { status: key } : { sort: key })
        }
        onClose={() => setPanel(null)}
      />

      {kind === 'empty' && filtered ? (
        <ManagementFilterClear onClick={clearFilters} />
      ) : null}

      <ManagementStates
        kind={kind}
        emptyText={filtered ? '未找到符合条件的角色' : '暂无角色'}
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
                description={role.description || '暂无描述'}
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
