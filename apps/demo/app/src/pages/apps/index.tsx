import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
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

  // 旧后台目录仍可能下发「常用」；它属于首页，不参与应用中心的分组和搜索。
  const catalogMenus = menus.filter((group) => !['常用', '常用应用'].includes(group.name.trim()))
  const groups = getWorkbenchGroups(catalogMenus, user?.permissions, enabledModuleIds)
  const apps = groups.flatMap((group) => group.apps)
  const searchGroups = query.trim()
    ? getWorkbenchGroups(catalogMenus, user?.permissions, enabledModuleIds, query)
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

  return (
    <PageContainer className={styles.apps}>
      <WorkbenchHeader loading={loading} loaded={loaded} onRefresh={retry} />
      <View className={styles.apps__searchWrap}>
        <View className={styles.apps__searchIcon} aria-hidden />
        <Input
          className={styles.apps__search}
          value={query}
          placeholder="搜索应用"
          onInput={(event) => setQuery(event.detail.value)}
        />
        {query ? (
          <Button className={styles.apps__clear} onClick={() => setQuery('')} aria-label="清空搜索">
            清空
          </Button>
        ) : null}
      </View>
      {!loaded ? (
        error ? (
          <ErrorState text={error} onRetry={retry} />
        ) : (
          <View className={styles.apps__section} aria-label="应用加载中">
            <View className={styles.apps__skeletonTitle} />
            <View className={styles.apps__grid}>
              {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => (
                <View key={id} className={styles.apps__item}>
                  <View className={styles.apps__skeletonIcon} />
                  <View className={styles.apps__skeletonLabel} />
                </View>
              ))}
            </View>
          </View>
        )
      ) : (
        <>
          {error ? (
            <View className={styles.apps__refreshError}>
              <Text>刷新失败，请重试</Text>
              <Button className={styles.apps__action} disabled={loading} onClick={retry}>
                重试
              </Button>
            </View>
          ) : null}
          {apps.length === 0 ? (
            <EmptyState text="暂无可用应用" />
          ) : searchGroups.length ? (
            searchGroups.map((group) => (
              <View key={group.id} className={styles.apps__section}>
                <Text className={styles.apps__category}>{group.name}</Text>
                <ApplicationGrid apps={group.apps} onOpen={open} />
              </View>
            ))
          ) : (
            <EmptyState text="未找到相关应用" />
          )}
        </>
      )}
    </PageContainer>
  )
}
