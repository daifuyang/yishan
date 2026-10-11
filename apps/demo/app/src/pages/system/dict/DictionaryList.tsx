import { useEffect, useState } from 'react'
import { useDidHide, useDidShow } from '@tarojs/taro'
import { View } from '@tarojs/components'
import { Tag } from '@/components/atoms'
import {
  BottomSelectSheet,
  ManagementCell,
  ManagementFilterBar,
  ManagementHeaderAction,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
  LinkRow,
} from '@/components/management'
import { useCanWrite, useListPagination } from '@/hooks'
import { navigateTo } from '@/utils/router'
import { SYSTEM_PAGES } from '@/constants/routes'
import * as api from '@/api/admin/dict'
import type { AdminDictType, AdminDictData } from '@/api/admin/types'
import { StateView } from '@/components/feedback'
import { errorMessage } from '../_shared/AdminUI'
import styles from './index.module.scss'

const statuses = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
]
export default function DictionaryList({ enabled, typeId }: { enabled: boolean; typeId?: number }) {
  const canCreate = useCanWrite('system:dict:create')
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<AdminDictType | null>(null)
  const [contextError, setContextError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    if (!enabled || !typeId) return
    setContextError('')
    api
      .getAdminDictType(typeId)
      .then((data) => {
        if (active) setContext(data)
      })
      .catch((cause) => {
        if (active) setContextError(errorMessage(cause))
      })
    return () => {
      active = false
    }
  }, [enabled, typeId, reload])
  const list = useListPagination<AdminDictType | AdminDictData>({
    enabled,
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const query = {
        page,
        pageSize,
        keyword: keyword || undefined,
        status:
          filters.status === '0' ? (0 as const) : filters.status === '1' ? (1 as const) : undefined,
      }
      const response = typeId
        ? await api.listAdminDictData({ ...query, typeId })
        : await api.listAdminDictTypes(query)
      return { list: response.data, total: response.pagination.total }
    },
  })
  useDidShow(() => {
    if (enabled) {
      void list.refresh()
      setReload((value) => value + 1)
    }
  })
  useDidHide(() => setOpen(false))
  const status = String(list.filters.status ?? '')
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
        title={typeId ? context?.name || '字典项' : '字典管理'}
        subtitle={`${list.total} 个${typeId ? '字典项' : '字典类型'}`}
        action={
          canCreate && (!typeId || context) ? (
            <ManagementHeaderAction
              label="新建"
              onClick={() =>
                navigateTo(
                  `/${typeId ? SYSTEM_PAGES.dictItemForm : SYSTEM_PAGES.dictForm}${typeId ? `?typeId=${typeId}` : ''}`,
                )
              }
            />
          ) : undefined
        }
      />
      {contextError ? (
        <StateView
          kind="error"
          text={contextError}
          onRetry={() => setReload((value) => value + 1)}
        />
      ) : null}
      <ManagementFilterBar>
        <ManagementSearchBar
          value={list.keyword}
          onChange={list.setKeyword}
          placeholder={typeId ? '搜索标签、键值' : '搜索名称、类型'}
        />
        <View className={styles.filter} onClick={() => setOpen(true)}>
          {statuses.find((option) => option.key === status)?.label || '全部状态'} ▾
        </View>
      </ManagementFilterBar>
      {context ? (
        <LinkRow
          label="所属字典"
          value={context.name}
          onClick={() => navigateTo(`/${SYSTEM_PAGES.dictDetail}?id=${context.id}`)}
        />
      ) : null}
      <ManagementStates
        kind={kind}
        emptyText={list.keyword || status ? '没有符合条件的字典' : '暂无数据'}
        errorText={list.error || undefined}
        onRetry={list.refresh}
      >
        <ManagementList>
          {list.list.map((record, index) => (
            <ManagementCell
              key={record.id}
              bordered={index < list.list.length - 1}
              glyph="folder"
              title={'label' in record ? record.label : record.name}
              description={
                'value' in record
                  ? `${record.value}${record.isDefault ? ' · 默认值' : ''}`
                  : record.type
              }
              tag={
                <Tag size="sm" variant={record.status === 1 ? 'success' : 'default'}>
                  {record.status === 1 ? '启用' : '禁用'}
                </Tag>
              }
              onClick={() =>
                navigateTo(
                  `/${typeId ? SYSTEM_PAGES.dictItemDetail : SYSTEM_PAGES.dictDetail}?id=${record.id}`,
                )
              }
            />
          ))}
        </ManagementList>
      </ManagementStates>
      <ManagementListFooter
        loadingMore={list.loadingMore}
        refreshing={list.refreshing}
        finished={list.finished}
        empty={!list.list.length}
      />
      <BottomSelectSheet
        open={open}
        title="字典状态"
        options={statuses}
        value={status}
        onSelect={(value) => list.setFilters({ status: value })}
        onClose={() => setOpen(false)}
      />
    </ManagementPage>
  )
}
