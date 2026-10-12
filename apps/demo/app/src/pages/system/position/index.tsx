import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { listAdminPositions } from '@/api/admin/position'
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
import { withAccountScope } from '../_shared/AdminUI'
import {
  buildPositionQuery,
  DEFAULT_POSITION_FILTERS,
  POSITION_SORT_OPTIONS,
  POSITION_STATUS_OPTIONS,
  readPositionFilters,
  type PositionFilters,
} from './filters'

function PositionPage() {
  const guard = useRequireAuth({ moduleId: 'system-position' })
  const canCreate = useCanWrite('system:position:create')
  const [panel, setPanel] = useState<string | null>(null)
  const list = useListPagination({
    enabled: guard.ready && guard.allowed,
    initialFilters: { ...DEFAULT_POSITION_FILTERS },
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const result = await listAdminPositions(
        buildPositionQuery(page, pageSize, keyword, readPositionFilters(filters)),
      )
      return { list: result.data, total: result.pagination.total }
    },
  })
  const positionFilters = readPositionFilters(list.filters)
  const filtered = Boolean(list.keyword || positionFilters.status)
  const changeFilters = (patch: Partial<PositionFilters>) => {
    list.setFilters(patch)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const clearFilters = () => {
    list.setKeyword('')
    changeFilters({ ...DEFAULT_POSITION_FILTERS })
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
    POSITION_STATUS_OPTIONS.find((option) => option.key === positionFilters.status)?.label ??
    POSITION_STATUS_OPTIONS[0].label
  const sortLabel =
    POSITION_SORT_OPTIONS.find((option) => option.key === positionFilters.sort)?.label ??
    POSITION_SORT_OPTIONS[0].label
  return (
    <ManagementPage>
      <ManagementPageHeader
        title="岗位管理"
        action={
          canCreate ? (
            <ManagementHeaderAction
              label="新建"
              onClick={() => navigateTo(`/${SYSTEM_PAGES.positionForm}`)}
            />
          ) : undefined
        }
      />
      <ManagementFilterBar>
        <ManagementSearchBar
          value={list.keyword}
          onChange={list.setKeyword}
          placeholder="搜索岗位名称或描述"
        />
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : key)}
          triggers={[
            { key: 'status', label: statusLabel, active: Boolean(positionFilters.status) },
            {
              key: 'sort',
              label: sortLabel,
              active: positionFilters.sort !== DEFAULT_POSITION_FILTERS.sort,
            },
          ]}
        />
      </ManagementFilterBar>
      <BottomSelectSheet
        open={panel === 'status' || panel === 'sort'}
        title={panel === 'status' ? '岗位状态' : '排序方式'}
        options={panel === 'status' ? POSITION_STATUS_OPTIONS : POSITION_SORT_OPTIONS}
        value={panel === 'status' ? positionFilters.status : positionFilters.sort}
        onSelect={(key) =>
          changeFilters(panel === 'status' ? { status: key } : { sort: key })
        }
        onClose={() => setPanel(null)}
      />
      {kind === 'empty' && filtered ? <ManagementFilterClear onClick={clearFilters} /> : null}
      <ManagementStates
        kind={kind}
        errorText={list.error || undefined}
        emptyText={filtered ? '未找到符合条件的岗位' : '暂无岗位'}
        onRetry={list.refresh}
      >
        <ManagementList>
          {list.list.map((position, index) => (
            <ManagementCell
              key={position.id}
              bordered={index < list.list.length - 1}
              glyph="folder"
              title={position.name}
              description={position.description || '暂无描述'}
              tag={
                <Tag size="sm" variant={position.status === '1' ? 'success' : 'default'}>
                  {position.status === '1' ? '启用' : '禁用'}
                </Tag>
              }
              onClick={() => navigateTo(`/${SYSTEM_PAGES.positionDetail}?id=${position.id}`)}
            />
          ))}
        </ManagementList>
      </ManagementStates>
      <ManagementListFooter
        loadingMore={list.loadingMore}
        refreshing={list.refreshing}
        finished={list.finished}
        empty={!list.list.length}
        summary={kind === 'ready' ? `共 ${list.total} 个岗位` : undefined}
      />
    </ManagementPage>
  )
}
export default withAccountScope(PositionPage)
