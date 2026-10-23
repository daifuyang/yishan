import { useDidHide } from '@tarojs/taro'
import { useState } from 'react'
import { listAdminLoginLogs } from '@/api/admin/loginLog'
import { Tag } from '@/components/atoms'
import { DateRangeSheet, ManagementCell, ManagementFilterBar, ManagementFilterSummary, ManagementFilterTriggers, ManagementList, ManagementListFooter, ManagementPage, ManagementPageHeader, ManagementSearchBar, ManagementStates } from '@/components/management'
import { LOGIN_LOG_SORT, LOGIN_LOG_STATUS, loginLogSortLabel, loginLogStatusLabel } from '@/constants/login-log'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useListPagination } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '@/utils/account-scope'
import { buildLoginLogQuery } from './query'

function LoginLogPage() {
  const guard = useRequireAuth({ moduleId: 'system-login-log' })
  const [panel, setPanel] = useState('')
  const list = useListPagination({ enabled: guard.ready && guard.allowed, fetcher: async ({ page, pageSize, keyword, filters }) => {
    const response = await listAdminLoginLogs(buildLoginLogQuery(page, pageSize, keyword, filters))
    return { list: response.data, total: response.pagination.total }
  } })
  useDidHide(() => setPanel(''))
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const status = String(list.filters.status || '')
  const sort = String(list.filters.sort || 'desc')
  const startDate = String(list.filters.startDate || '')
  const endDate = String(list.filters.endDate || '')
  const hasDates = Boolean(startDate || endDate)
  const kind = list.error ? 'error' : list.loading && !list.list.length ? 'loading' : !list.list.length ? 'empty' : 'ready'
  return <ManagementPage>
    <ManagementPageHeader title="登录日志" showBack={process.env.TARO_ENV === 'h5'} />
    <ManagementFilterBar>
      <ManagementSearchBar value={list.keyword} onChange={list.setKeyword} placeholder="搜索账号、姓名、IP或提示" />
      <ManagementFilterTriggers panel={panel} onPanelChange={setPanel} triggers={[{ key: 'status', label: loginLogStatusLabel(status), active: Boolean(status), picker: { title: '登录状态', options: LOGIN_LOG_STATUS, value: status, onSelect: key => list.setFilters({ status: key }) } }, { key: 'sort', label: loginLogSortLabel(sort), active: sort === 'asc', picker: { title: '排序方式', options: LOGIN_LOG_SORT, value: sort, onSelect: key => list.setFilters({ sort: key }) } }, { key: 'dates', label: hasDates ? '时间 · 1' : '登录时间', active: hasDates }]} />
      {hasDates ? <ManagementFilterSummary onClear={() => list.setFilters({ startDate: '', endDate: '' })} clearLabel="清除登录时间筛选">{startDate || '不限'} 至 {endDate || '不限'}</ManagementFilterSummary> : null}
    </ManagementFilterBar>
    <ManagementStates kind={kind} errorText={list.error || undefined} emptyText={list.keyword || status || hasDates ? '未找到符合条件的登录日志' : '暂无登录日志'} onRetry={list.refresh}>
      <ManagementList>{list.list.map((record, index) => <ManagementCell key={record.id} bordered={index < list.list.length - 1} glyph="shield" title={record.realName || record.username} description={formatDateTime(record.createdAt)} tag={<Tag size="sm" variant={record.status === '1' ? 'success' : 'danger'}>{record.status === '1' ? '成功' : '失败'}</Tag>} onClick={() => navigateTo(`/${SYSTEM_PAGES.loginLogDetail}?id=${record.id}`)} />)}</ManagementList>
    </ManagementStates>
    <ManagementListFooter loadingMore={list.loadingMore} refreshing={list.refreshing} finished={list.finished} empty={!list.list.length} summary={kind === 'ready' ? `共 ${list.total} 条记录` : undefined} />
    {panel === 'dates' ? <DateRangeSheet title="登录时间" heading="选择日期范围，开始或结束可单独设置" allowPartial startDate={startDate} endDate={endDate} onClose={() => setPanel('')} onConfirm={dates => { list.setFilters({ ...dates }); setPanel('') }} /> : null}
  </ManagementPage>
}
export default withAccountScope(LoginLogPage)

