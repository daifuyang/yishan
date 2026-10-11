import { useState } from 'react'
import {
  BottomSelectSheet,
  DateRangeSheet,
  ManagementFilterBar,
  ManagementFilterSummary,
  ManagementFilterTriggers,
  ManagementSearchBar,
} from '@/components/management'
import { USER_SORT_OPTIONS, USER_STATUS_OPTIONS, type UserFilters } from './filters'

export function UserFilterBar({
  keyword,
  onKeywordChange,
  filters,
  onChange,
}: {
  keyword: string
  onKeywordChange: (value: string) => void
  filters: UserFilters
  onChange: (patch: Partial<UserFilters>) => void
}) {
  const [panel, setPanel] = useState<string | null>(null)
  const status =
    USER_STATUS_OPTIONS.find((option) => option.key === filters.status) ?? USER_STATUS_OPTIONS[0]
  const sort =
    USER_SORT_OPTIONS.find((option) => option.key === filters.sort) ?? USER_SORT_OPTIONS[0]
  const hasDates = Boolean(filters.startDate || filters.endDate)

  return (
    <ManagementFilterBar>
      <ManagementSearchBar
        value={keyword}
        onChange={onKeywordChange}
        placeholder="搜索用户名、姓名或邮箱"
      />
      <ManagementFilterTriggers
        panel={panel}
        onPanelChange={(key) => setPanel(panel === key ? null : key)}
        triggers={[
          { key: 'status', label: status.label, active: Boolean(filters.status) },
          { key: 'sort', label: sort.label, active: filters.sort !== 'createdDesc' },
          { key: 'dates', label: hasDates ? '筛选 · 1' : '筛选', active: hasDates },
        ]}
      />
      {hasDates ? (
        <ManagementFilterSummary
          onClear={() => onChange({ startDate: '', endDate: '' })}
          clearLabel="清除创建时间筛选"
        >
          {filters.startDate} 至 {filters.endDate} 创建
        </ManagementFilterSummary>
      ) : null}
      <BottomSelectSheet
        open={panel === 'status' || panel === 'sort'}
        title={panel === 'status' ? '用户状态' : '排序方式'}
        options={panel === 'status' ? USER_STATUS_OPTIONS : USER_SORT_OPTIONS}
        value={panel === 'status' ? filters.status : filters.sort}
        onSelect={(key) => onChange(panel === 'status' ? { status: key } : { sort: key })}
        onClose={() => setPanel(null)}
      />
      {panel === 'dates' ? (
        <DateRangeSheet
          title="筛选用户"
          heading="创建时间"
          presets
          startDate={filters.startDate}
          endDate={filters.endDate}
          onConfirm={(range) => {
            onChange(range)
            setPanel(null)
          }}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </ManagementFilterBar>
  )
}
