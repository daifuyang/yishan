import { useState } from 'react'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import * as api from '@/api/admin/dept'
import type { AdminDept } from '@/api/admin/types'
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
import { SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite, useListPagination } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '@/utils/account-scope'
import {
  buildDeptQuery,
  DEFAULT_DEPT_FILTERS,
  DEPT_SORT_OPTIONS,
  DEPT_STATUS_OPTIONS,
  readDeptFilters,
  type DeptFilters,
} from './filters'

function DeptIndexPage() {
  const guard = useRequireAuth({ moduleId: 'system-dept' })
  const canCreate = useCanWrite('system:department:create')
  const [panel, setPanel] = useState<string | null>(null)
  const list = useListPagination<AdminDept>({
    enabled: guard.ready && guard.allowed,
    initialFilters: { ...DEFAULT_DEPT_FILTERS },
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const { data, pagination } = await api.listAdminDepts(
        buildDeptQuery(page, pageSize, keyword, readDeptFilters(filters)),
      )
      return { list: data, total: pagination.total }
    },
  })
  const deptFilters = readDeptFilters(list.filters)
  const filtered = Boolean(list.keyword || deptFilters.status)
  const changeFilters = (patch: Partial<DeptFilters>) => {
    list.setFilters(patch)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const clearFilters = () => {
    list.setKeyword('')
    changeFilters({ ...DEFAULT_DEPT_FILTERS })
  }
  useDidShow(() => {
    if (guard.ready && guard.allowed) void list.refresh()
  })
  useDidHide(() => setPanel(null))
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const kind = list.error
    ? 'error'
    : list.loading && !list.list.length
      ? 'loading'
      : !list.list.length
        ? 'empty'
        : 'ready'
  const statusLabel =
    DEPT_STATUS_OPTIONS.find((option) => option.key === deptFilters.status)?.label ??
    DEPT_STATUS_OPTIONS[0].label
  const sortLabel =
    DEPT_SORT_OPTIONS.find((option) => option.key === deptFilters.sort)?.label ??
    DEPT_SORT_OPTIONS[0].label
  return (
    <ManagementPage>
      <ManagementPageHeader
        title="部门管理"
        action={
          canCreate ? (
            <ManagementHeaderAction
              label="新建"
              onClick={() => navigateTo(`/${SYSTEM_PAGES.deptForm}`)}
            />
          ) : undefined
        }
      />
      <ManagementFilterBar>
        <ManagementSearchBar
          value={list.keyword}
          onChange={list.setKeyword}
          placeholder="搜索部门名称或描述"
        />
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : key)}
          triggers={[
            { key: 'status', label: statusLabel, active: Boolean(deptFilters.status) },
            {
              key: 'sort',
              label: sortLabel,
              active: deptFilters.sort !== DEFAULT_DEPT_FILTERS.sort,
            },
          ]}
        />
      </ManagementFilterBar>
      <BottomSelectSheet
        open={panel === 'status' || panel === 'sort'}
        title={panel === 'status' ? '部门状态' : '排序方式'}
        options={panel === 'status' ? DEPT_STATUS_OPTIONS : DEPT_SORT_OPTIONS}
        value={panel === 'status' ? deptFilters.status : deptFilters.sort}
        onSelect={(key) => changeFilters(panel === 'status' ? { status: key } : { sort: key })}
        onClose={() => setPanel(null)}
      />
      {kind === 'empty' && filtered ? <ManagementFilterClear onClick={clearFilters} /> : null}
      <ManagementStates
        kind={kind}
        errorText={list.error || undefined}
        emptyText={filtered ? '未找到符合条件的部门' : '暂无部门'}
        onRetry={list.refresh}
      >
        <ManagementList>
          {list.list.map((dept, index) => (
            <ManagementCell
              key={dept.id}
              bordered={index < list.list.length - 1}
              glyph="folder"
              title={dept.name}
              description={`${dept.parentName || '顶级部门'} · 负责人：${dept.leaderName || dept.leaderId || '未设置'}`}
              tag={
                <Tag size="sm" variant={dept.status === '1' ? 'success' : 'default'}>
                  {dept.status === '1' ? '启用' : '禁用'}
                </Tag>
              }
              onClick={() => navigateTo(`/${SYSTEM_PAGES.deptDetail}?id=${dept.id}`)}
            />
          ))}
        </ManagementList>
      </ManagementStates>
      <ManagementListFooter
        loadingMore={list.loadingMore}
        refreshing={list.refreshing}
        finished={list.finished}
        empty={!list.list.length}
        summary={kind === 'ready' ? `共 ${list.total} 个部门` : undefined}
      />
    </ManagementPage>
  )
}
export default withAccountScope(DeptIndexPage)
