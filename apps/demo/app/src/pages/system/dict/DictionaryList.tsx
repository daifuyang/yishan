import { useEffect, useState } from 'react'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { View } from '@tarojs/components'
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
  LinkRow,
} from '@/components/management'
import { useCanWrite, useListPagination } from '@/hooks'
import { navigateTo } from '@/utils/router'
import { SYSTEM_PAGES } from '@/constants/routes'
import * as api from '@/api/admin/dict'
import type { AdminDictType, AdminDictData } from '@/api/admin/types'
import { StateView } from '@/components/feedback'
import { errorMessage } from '@/utils/account-scope'
import {
  buildDictQuery,
  DEFAULT_DICT_FILTERS,
  DICT_SORT_OPTIONS,
  DICT_STATUS_OPTIONS,
  readDictFilters,
  type DictFilters,
} from './filters'
import styles from './index.module.scss'

export default function DictionaryList({ enabled, typeId }: { enabled: boolean; typeId?: number }) {
  const canCreate = useCanWrite('system:dict:create')
  const [panel, setPanel] = useState<string | null>(null)
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
    initialFilters: { ...DEFAULT_DICT_FILTERS },
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const query = buildDictQuery(page, pageSize, keyword, readDictFilters(filters))
      const response = typeId
        ? await api.listAdminDictData({ ...query, typeId })
        : await api.listAdminDictTypes(query)
      return { list: response.data, total: response.pagination.total }
    },
  })
  const dictFilters = readDictFilters(list.filters)
  const filtered = Boolean(list.keyword || dictFilters.status)
  const changeFilters = (patch: Partial<DictFilters>) => {
    list.setFilters(patch)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const clearFilters = () => {
    list.setKeyword('')
    changeFilters({ ...DEFAULT_DICT_FILTERS })
  }
  useDidShow(() => {
    if (enabled) {
      void list.refresh()
      setReload((value) => value + 1)
    }
  })
  useDidHide(() => setPanel(null))
  const kind = list.error
    ? 'error'
    : list.loading && !list.list.length
      ? 'loading'
      : !list.list.length
        ? 'empty'
        : 'ready'
  const statusLabel =
    DICT_STATUS_OPTIONS.find((option) => option.key === dictFilters.status)?.label ??
    DICT_STATUS_OPTIONS[0].label
  const sortLabel =
    DICT_SORT_OPTIONS.find((option) => option.key === dictFilters.sort)?.label ??
    DICT_SORT_OPTIONS[0].label
  return (
    <ManagementPage>
      <ManagementPageHeader
        title={typeId ? context?.name || '字典项' : '字典管理'}
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
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : key)}
          triggers={[
            { key: 'status', label: statusLabel, active: Boolean(dictFilters.status) },
            {
              key: 'sort',
              label: sortLabel,
              active: dictFilters.sort !== DEFAULT_DICT_FILTERS.sort,
            },
          ]}
        />
      </ManagementFilterBar>
      <BottomSelectSheet
        open={panel === 'status' || panel === 'sort'}
        title={panel === 'status' ? '字典状态' : '排序方式'}
        options={panel === 'status' ? DICT_STATUS_OPTIONS : DICT_SORT_OPTIONS}
        value={panel === 'status' ? dictFilters.status : dictFilters.sort}
        onSelect={(key) => changeFilters(panel === 'status' ? { status: key } : { sort: key })}
        onClose={() => setPanel(null)}
      />
      {context ? (
        <View className={styles.context}>
          <LinkRow
            label="所属字典"
            value={context.name}
            onClick={() => navigateTo(`/${SYSTEM_PAGES.dictDetail}?id=${context.id}`)}
          />
        </View>
      ) : null}
      {kind === 'empty' && filtered ? <ManagementFilterClear onClick={clearFilters} /> : null}
      <ManagementStates
        kind={kind}
        emptyText={filtered ? '没有符合条件的字典' : '暂无数据'}
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
        summary={
          kind === 'ready' ? `共 ${list.total} 个${typeId ? '字典项' : '字典类型'}` : undefined
        }
      />
    </ManagementPage>
  )
}
