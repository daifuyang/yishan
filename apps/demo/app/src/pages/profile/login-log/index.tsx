import { useDidHide } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { userApi } from '@/api'
import type { LoginLog } from '@/api/types'
import { Tag } from '@/components/atoms'
import {
  BottomSelectSheet,
  DateRangeSheet,
  ManagementCell,
  ManagementFilterBar,
  ManagementFilterSummary,
  ManagementFilterTriggers,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementStates,
} from '@/components/management'
import { parseDateBoundary } from '@/components/management/dateRange'
import {
  LOGIN_LOG_SORT,
  LOGIN_LOG_STATUS,
  loginLogSortLabel,
  loginLogStatusLabel,
} from '@/constants/login-log'
import { SECONDARY_PAGES } from '@/constants/routes'
import { useListPagination } from '@/hooks'
import { withAccountScope } from '@/utils/account-scope'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateTo } from '@/utils/router'

const PAGE_SIZE = 10
/**
 * 应用接口只返回一页、不给总数：满页时用一个「至少还有下一页」的哨兵值，
 * 让 useListPagination 的分页保持未完成；短页（含空页）即视为到底。
 */
const UNKNOWN_TOTAL = Number.MAX_SAFE_INTEGER
/**
 * 自动续拉的上限（页）：筛选一个匹配都没有时最多再翻这么多页就停手，
 * 让「怎么筛都没有」不至于变成无限请求。
 */
const AUTO_CONTINUE_LIMIT = 5

/**
 * 状态 / 排序 / 时间范围都在客户端完成。
 *
 * `/api/v1/app/users/me/login-logs` 只接受 `page` + `pageSize`（服务端刻意不开放关键词与状态筛选），
 * 传筛选参数会被 Fastify 静默丢弃，所以筛选绝不能退回给接口，只能作用于已加载的记录。
 */
function filterLogs(records: LoginLog[], filters: Record<string, string>): LoginLog[] {
  const status = filters.status === '0' || filters.status === '1' ? filters.status : ''
  const start = parseDateBoundary(filters.startDate || '')
  const end = parseDateBoundary(filters.endDate || '', true)
  const startAt = start ? new Date(start).getTime() : null
  const endAt = end ? new Date(end).getTime() : null
  const matched = records.filter((record) => {
    if (status && record.status !== status) return false
    const at = new Date(record.createdAt).getTime()
    if (startAt !== null && !(at >= startAt)) return false
    if (endAt !== null && !(at <= endAt)) return false
    return true
  })
  const direction = filters.sort === 'asc' ? 1 : -1
  return matched.sort(
    (a, b) => (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction,
  )
}

function ProfileLoginLog() {
  const guard = useRequireAuth()
  const [panel, setPanel] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [autoContinued, setAutoContinued] = useState(0)
  const list = useListPagination<LoginLog>({
    enabled: guard.ready && guard.allowed,
    pageSize: PAGE_SIZE,
    fetcher: async ({ page, pageSize }) => {
      const items = await userApi.getMyLoginLogs({ page, pageSize })
      return {
        list: items,
        total: items.length < pageSize ? (page - 1) * pageSize + items.length : UNKNOWN_TOTAL,
      }
    },
  })
  useDidHide(() => setPanel(''))

  const status = String(filters.status || '')
  const sort = String(filters.sort || 'desc')
  const startDate = String(filters.startDate || '')
  const endDate = String(filters.endDate || '')
  const hasDates = Boolean(startDate || endDate)
  const hasFilter = Boolean(status) || hasDates
  const records = filterLogs(list.list, filters)
  const empty = !records.length
  // 筛选只作用于已加载的记录，命中项可能落在还没拉到的页里。空态下页面不滚动，
  // useReachBottom 永远不会触发，所以要主动续拉；但封顶 AUTO_CONTINUE_LIMIT 页。
  const seeking =
    hasFilter && empty && !list.error && !list.finished && autoContinued < AUTO_CONTINUE_LIMIT
  // 还在替这个筛选翻页时，空态不能替服务端下结论。
  const kind = list.error
    ? 'error'
    : empty && (list.loading || seeking)
      ? 'loading'
      : empty
        ? 'empty'
        : 'ready'

  // 换筛选就重新计数：上一轮续拉掉的配额不属于新筛选。
  const filterKey = `${status}|${startDate}|${endDate}`
  useEffect(() => {
    setAutoContinued(0)
  }, [filterKey])
  useEffect(() => {
    if (!seeking || list.loading || list.loadingMore) return
    setAutoContinued((previous) => previous + 1)
    void list.loadMore()
  }, [seeking, autoContinued, list.loading, list.loadingMore, list.loadMore])

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      <ManagementPageHeader title="登录日志" showBack={process.env.TARO_ENV === 'h5'} />
      <ManagementFilterBar>
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={setPanel}
          triggers={[
            { key: 'status', label: loginLogStatusLabel(status), active: Boolean(status) },
            { key: 'sort', label: loginLogSortLabel(sort), active: sort === 'asc' },
            { key: 'dates', label: hasDates ? '时间 · 1' : '登录时间', active: hasDates },
          ]}
        />
        {hasDates ? (
          <ManagementFilterSummary
            onClear={() => setFilters((previous) => ({ ...previous, startDate: '', endDate: '' }))}
            clearLabel="清除登录时间筛选"
          >
            {startDate || '不限'} 至 {endDate || '不限'}
          </ManagementFilterSummary>
        ) : null}
      </ManagementFilterBar>
      <ManagementStates
        kind={kind}
        errorText={list.error || undefined}
        emptyText={status || hasDates ? '未找到符合条件的登录日志' : '暂无登录日志'}
        onRetry={list.refresh}
      >
        <ManagementList>
          {records.map((record, index) => (
            <ManagementCell
              key={record.id}
              bordered={index < records.length - 1}
              title={formatDateTime(record.createdAt)}
              description={record.ipAddress || '未知IP'}
              tag={
                <Tag size="sm" variant={record.status === '1' ? 'success' : 'danger'}>
                  {record.status === '1' ? '成功' : '失败'}
                </Tag>
              }
              onClick={() =>
                navigateTo(`/${SECONDARY_PAGES.profileLoginLogDetail}?id=${record.id}`)
              }
            />
          ))}
        </ManagementList>
      </ManagementStates>
      {/* 接口不返回总数，筛选也只是客户端行为：底部只报「当前显示」，绝不写成会被读成服务端统计的总数。
          没命中的只是筛选：已加载的记录非空时 footer 仍要留出「上拉加载更多」的手动出口。 */}
      <ManagementListFooter
        loadingMore={list.loadingMore}
        refreshing={list.refreshing}
        finished={list.finished}
        empty={!list.list.length}
        summary={kind === 'ready' && records.length ? `当前显示 ${records.length} 条` : undefined}
      />
      <BottomSelectSheet
        open={panel === 'status' || panel === 'sort'}
        title={panel === 'status' ? '登录状态' : '排序方式'}
        options={panel === 'status' ? LOGIN_LOG_STATUS : LOGIN_LOG_SORT}
        value={panel === 'status' ? status : sort}
        onSelect={(key) =>
          setFilters((previous) =>
            panel === 'status' ? { ...previous, status: key } : { ...previous, sort: key },
          )
        }
        onClose={() => setPanel('')}
      />
      {panel === 'dates' ? (
        <DateRangeSheet
          title="登录时间"
          heading="选择日期范围，开始或结束可单独设置"
          allowPartial
          startDate={startDate}
          endDate={endDate}
          onClose={() => setPanel('')}
          onConfirm={(dates) => {
            setFilters((previous) => ({ ...previous, ...dates }))
            setPanel('')
          }}
        />
      ) : null}
    </ManagementPage>
  )
}

export default withAccountScope(ProfileLoginLog)
