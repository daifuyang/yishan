import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { ManagementFilterBar, ManagementSearchBar, ManagementStates } from '@/components/management'
import { getWorkbenchGroups } from '@/modules/registry'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import { useRequireAuth } from '@/utils/auth-guard'
import { ApplicationGrid } from './ApplicationGrid'
import styles from './index.module.scss'
import { openWorkbenchApp } from './navigation'
import { WorkbenchHeader } from './WorkbenchHeader'

export default function AppsPage() {
  const guard = useRequireAuth()
  const menus = useModuleStore((state) => state.menus)
  const loading = useModuleStore((state) => state.loading)
  const error = useModuleStore((state) => state.error)
  const loaded = useModuleStore((state) => state.loaded)
  const user = useAuthStore((state) => state.user)
  const enabledModuleIds = useAuthStore((state) => state.enabledModuleIds)
  const [query, setQuery] = useState('')
  const visible = useRef(false)

  useEffect(() => {
    if (guard.ready && visible.current && !loaded) void useModuleStore.getState().load()
  }, [guard.ready, loaded, user?.id, user?.permissions, enabledModuleIds])
  useEffect(() => {
    setQuery('')
  }, [user?.id])
  useDidShow(() => {
    visible.current = true
    void useModuleStore.getState().load({ force: useModuleStore.getState().loaded })
  })
  useDidHide(() => {
    visible.current = false
  })
  usePullDownRefresh(async () => {
    try {
      await useModuleStore.getState().load({ force: true })
    } finally {
      Taro.stopPullDownRefresh()
    }
  })

  const groups = getWorkbenchGroups(menus, user?.permissions, enabledModuleIds)
  const apps = groups.flatMap((group) => group.apps)
  const searchGroups = query.trim()
    ? getWorkbenchGroups(menus, user?.permissions, enabledModuleIds, query)
    : groups
  const retry = () => void useModuleStore.getState().load({ force: true })
  const open = (id: string) => {
    void openWorkbenchApp(id).catch((failure: unknown) => {
      Taro.showToast({
        title: failure instanceof Error ? failure.message : '无法打开应用，请重试',
        icon: 'none',
      })
    })
  }

  // 加载/错误/空与列表统一交给共享 ManagementStates：没有任何应用时才叫「暂无可用应用」
  const emptyText = query.trim() && apps.length > 0 ? '未找到相关应用' : '暂无可用应用'
  const kind = !loaded ? (error ? 'error' : 'loading') : searchGroups.length ? 'ready' : 'empty'

  return (
    <PageContainer className={styles.apps}>
      <WorkbenchHeader />
      <ManagementFilterBar className={styles.apps__filters}>
        <ManagementSearchBar value={query} onChange={setQuery} placeholder="搜索应用" />
      </ManagementFilterBar>
      {/* 已加载但刷新失败：数据还在，只在列表上方提示，不用整屏错误态 */}
      {loaded && error ? (
        <View className={styles.apps__refreshError}>
          <Text>刷新失败，请重试</Text>
          <Button className={styles.apps__action} disabled={loading} onClick={retry}>
            重试
          </Button>
        </View>
      ) : null}
      <ManagementStates
        kind={kind}
        errorText={error ?? undefined}
        emptyText={emptyText}
        onRetry={retry}
      >
        {searchGroups.map((group) => (
          <View key={group.id} className={styles.apps__section}>
            <Text className={styles.apps__category}>{group.name}</Text>
            <ApplicationGrid apps={group.apps} onOpen={open} />
          </View>
        ))}
      </ManagementStates>
    </PageContainer>
  )
}
