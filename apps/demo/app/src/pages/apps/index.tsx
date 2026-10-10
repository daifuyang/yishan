import { useEffect, useRef, useState } from 'react'
import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { getWorkbenchGroups, type WorkbenchApp } from '@/modules/registry'
import { useModuleStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useRequireAuth } from '@/utils/auth-guard'
import { ApplicationGrid } from './ApplicationGrid'
import { FavoritesEditor } from './FavoritesEditor'
import { openWorkbenchApp } from './navigation'
import styles from './index.module.scss'

export default function AppsPage() {
  const guard = useRequireAuth()
  const menus = useModuleStore((state) => state.menus)
  const loading = useModuleStore((state) => state.loading)
  const error = useModuleStore((state) => state.error)
  const loaded = useModuleStore((state) => state.loaded)
  const favorites = useModuleStore((state) => state.commonModuleIds)
  const user = useAuthStore((state) => state.user)
  const enabledModuleIds = useAuthStore((state) => state.enabledModuleIds)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const visible = useRef(false)

  useEffect(() => {
    if (guard.ready && visible.current && !loaded) void useModuleStore.getState().load()
  }, [guard.ready, loaded, user?.id, user?.permissions, enabledModuleIds])
  useEffect(() => {
    setQuery('')
    setEditing(false)
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
  const common = favorites
    .map((id) => apps.find((app) => app.id === id))
    .filter((app): app is WorkbenchApp => Boolean(app))
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
      <View className={styles.apps__header}>
        <Text className={styles.apps__pageTitle}>工作台</Text>
        <Button className={styles.apps__action} disabled={loading} onClick={retry}>
          {loading && loaded ? '刷新中' : '刷新'}
        </Button>
      </View>
      {!editing ? (
        <View className={styles.apps__searchWrap}>
          <Input
            className={styles.apps__search}
            value={query}
            placeholder="搜索应用"
            onInput={(event) => setQuery(event.detail.value)}
          />
          {query ? (
            <Button
              className={styles.apps__clear}
              onClick={() => setQuery('')}
              aria-label="清空搜索"
            >
              清空
            </Button>
          ) : null}
        </View>
      ) : null}
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
          {editing ? (
            <FavoritesEditor key={user?.id} apps={apps} onClose={() => setEditing(false)} />
          ) : apps.length === 0 ? (
            <EmptyState text="暂无可用应用" />
          ) : (
            <>
              {!query.trim() ? (
                <View className={styles.apps__section}>
                  <View className={styles.apps__sectionHeader}>
                    <Text className={styles.apps__title}>常用应用</Text>
                    <Button className={styles.apps__action} onClick={() => setEditing(true)}>
                      编辑
                    </Button>
                  </View>
                  {common.length ? (
                    <ApplicationGrid apps={common} onOpen={open} />
                  ) : (
                    <Text className={styles.apps__hint}>点击编辑，添加常用应用</Text>
                  )}
                </View>
              ) : null}
              <View className={styles.apps__section}>
                <View className={styles.apps__sectionHeader}>
                  <Text className={styles.apps__title}>
                    {query.trim() ? '搜索结果' : '全部应用'}
                  </Text>
                </View>
                {searchGroups.length ? (
                  searchGroups.map((group) => (
                    <View key={group.id} className={styles.apps__group}>
                      <Text className={styles.apps__category}>{group.name}</Text>
                      <ApplicationGrid apps={group.apps} onOpen={open} />
                    </View>
                  ))
                ) : (
                  <EmptyState text="未找到相关应用" />
                )}
              </View>
            </>
          )}
        </>
      )}
    </PageContainer>
  )
}
