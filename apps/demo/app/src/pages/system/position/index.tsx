import { Text, View } from '@tarojs/components'
import { useDidHide, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { listAdminPositions } from '@/api/admin/position'
import { Tag } from '@/components/atoms'
import {
  BottomSelectSheet,
  LineIcon,
  ManagementCell,
  ManagementFilterBar,
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
import { POSITION_STATUSES } from './model'
import styles from './index.module.scss'

function PositionPage() {
  const guard = useRequireAuth({ moduleId: 'system-position' })
  const canCreate = useCanWrite('system:position:create')
  const [statusOpen, setStatusOpen] = useState(false)
  const list = useListPagination({
    enabled: guard.ready && guard.allowed,
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const result = await listAdminPositions({
        page,
        pageSize,
        keyword,
        status: filters.status === '1' || filters.status === '0' ? filters.status : undefined,
      })
      return { list: result.data, total: result.pagination.total }
    },
  })
  useDidShow(() => {
    if (guard.ready && guard.allowed) void list.refresh()
  })
  useDidHide(() => setStatusOpen(false))
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const status = String(list.filters.status || '')
  const kind = list.error
    ? 'error'
    : list.loading && !list.list.length
      ? 'loading'
      : !list.list.length
        ? 'empty'
        : 'ready'
  return (
    <ManagementPage>
      <ManagementPageHeader
        title="岗位管理"
        subtitle={`${list.total} 个岗位`}
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
          placeholder="搜索岗位"
        />
        <View
          className={`${styles.filter} ${status ? styles.active : ''}`}
          onClick={() => setStatusOpen(true)}
          aria-label="筛选岗位状态"
        >
          <Text>
            {POSITION_STATUSES.find((option) => option.key === status)?.label || '全部状态'}
          </Text>
          <LineIcon name="chevronDown" size={16} color={status ? '#1677FF' : '#86909C'} />
        </View>
      </ManagementFilterBar>
      <ManagementStates
        kind={kind}
        errorText={list.error || undefined}
        emptyText={list.keyword || status ? '未找到符合条件的岗位' : '暂无岗位'}
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
      <BottomSelectSheet
        open={statusOpen}
        title="岗位状态"
        options={POSITION_STATUSES}
        value={status}
        onSelect={(value) => list.setFilters({ status: value })}
        onClose={() => setStatusOpen(false)}
      />
    </ManagementPage>
  )
}
export default withAccountScope(PositionPage)
