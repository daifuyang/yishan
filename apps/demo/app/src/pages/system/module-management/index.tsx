import Taro, { useDidHide, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { listManagedModules, type ManagedModule } from '@/api/admin/moduleManagement'
import { Tag } from '@/components/atoms'
import {
  ManagementCell,
  ManagementFilterBar,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../_shared/AdminUI'

function ModuleManagementPage() {
  const guard = useRequireAuth({ moduleId: 'system-module-management' })
  const [items, setItems] = useState<ManagedModule[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const refreshOnShow = useRef(false)
  useEffect(() => {
    if (!guard.allowed) return
    let active = true
    setLoading(true)
    setError('')
    listManagedModules()
      .then((data) => {
        if (active) setItems(data.items)
      })
      .catch((reason) => {
        if (active)
          setError(
            reason &&
              typeof reason === 'object' &&
              'httpStatus' in reason &&
              reason.httpStatus === 404
              ? '当前服务器未开放模块管理'
              : errorMessage(reason),
          )
      })
      .finally(() => {
        if (active) {
          setLoading(false)
          void Taro.stopPullDownRefresh()
        }
      })
    return () => {
      active = false
    }
  }, [guard.allowed, revision])
  useDidHide(() => {
    refreshOnShow.current = true
  })
  useDidShow(() => {
    if (refreshOnShow.current) {
      refreshOnShow.current = false
      setRevision((value) => value + 1)
    }
  })
  usePullDownRefresh(() => {
    if (guard.allowed) setRevision((value) => value + 1)
    else void Taro.stopPullDownRefresh()
  })
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const rows = items.filter((item) =>
    `${item.name} ${item.id}`.toLowerCase().includes(keyword.trim().toLowerCase()),
  )
  return (
    <ManagementPage>
      <ManagementPageHeader title="模块管理" />
      <ManagementFilterBar>
        <ManagementSearchBar
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索模块名称或标识"
        />
      </ManagementFilterBar>
      <ManagementStates
        kind={loading ? 'loading' : error ? 'error' : rows.length ? 'ready' : 'empty'}
        errorText={error}
        emptyText={keyword ? '未找到符合条件的模块' : '暂无已安装模块'}
        onRetry={() => setRevision((value) => value + 1)}
      >
        <ManagementList>
          {rows.map((item, index) => (
            <ManagementCell
              key={item.id}
              glyph="folder"
              title={item.name}
              description={`版本 ${item.version} · ${item.mounted ? '已挂载' : '未挂载'}`}
              tag={
                <Tag size="sm" variant={item.enabled ? 'success' : 'default'}>
                  {item.enabled ? '启用' : '停用'}
                </Tag>
              }
              bordered={index < rows.length - 1}
              onClick={() =>
                navigateTo(`/${SYSTEM_PAGES.moduleDetail}?id=${encodeURIComponent(item.id)}`)
              }
            />
          ))}
        </ManagementList>
      </ManagementStates>
      {!loading && !error ? (
        <ManagementListFooter finished empty={!rows.length} summary={`共 ${rows.length} 个模块`} />
      ) : null}
    </ManagementPage>
  )
}
export default withAccountScope(ModuleManagementPage)
