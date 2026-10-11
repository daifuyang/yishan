import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import { useDidHide, useDidShow } from '@tarojs/taro'
import * as api from '@/api/admin/dept'
import type { AdminDept } from '@/api/admin/types'
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
import styles from './index.module.scss'

const STATUSES = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

function DeptIndexPage() {
  const guard = useRequireAuth({ moduleId: 'system-dept' })
  const canCreate = useCanWrite('system:department:create')
  const [statusOpen, setStatusOpen] = useState(false)
  const list = useListPagination<AdminDept>({
    enabled: guard.ready && guard.allowed,
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const { data, pagination } = await api.listAdminDepts({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: filters.status === '0' || filters.status === '1' ? filters.status : undefined,
      })
      return { list: data, total: pagination.total }
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
        title="部门管理"
        subtitle={`${list.total} 个部门`}
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
          placeholder="搜索部门名称、描述"
        />
        <View
          className={styles.filter}
          onClick={() => setStatusOpen(true)}
          aria-label="筛选部门状态"
        >
          <Text className={status ? styles.active : ''}>
            {STATUSES.find((item) => item.key === status)?.label || '全部状态'}
          </Text>
          <LineIcon name="chevronDown" size={14} color={status ? '#1677FF' : '#86909C'} />
        </View>
      </ManagementFilterBar>
      <ManagementStates
        kind={kind}
        errorText={list.error || undefined}
        emptyText={list.keyword || status ? '未找到符合条件的部门' : '暂无部门'}
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
      <BottomSelectSheet
        open={statusOpen}
        title="部门状态"
        options={STATUSES}
        value={status}
        onSelect={(value) => list.setFilters({ status: value })}
        onClose={() => setStatusOpen(false)}
      />
    </ManagementPage>
  )
}
export default withAccountScope(DeptIndexPage)
