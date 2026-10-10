import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useEffect, useMemo } from 'react'

import { PageContainer } from '@/components/layout'
import { APP_NAME } from '@/constants'
import { SECONDARY_PAGES, TAB_PAGES } from '@/constants/routes'
import { flattenMenus, getAuthorizedMobileModules, getMobileModule } from '@/modules/registry'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo, switchTab } from '@/utils/router'

import logo from '@/assets/brand/logo.png'
import { DashboardMetrics } from './components/DashboardMetrics'
import { type FavoriteAppItem, FavoriteApps } from './components/FavoriteApps'
import { HomeIcon } from './components/HomeIcon'
import { HomeSection, SectionLink } from './components/HomeSection'
import { TodoPreview } from './components/TodoPreview'
import { resolveHomeIcon } from './home-icons'
import type { HomeMetricDef } from './home-metrics'
import { useHomeMetrics } from './useHomeMetrics'
import { useHomeTodos } from './useHomeTodos'
import styles from './index.module.scss'

const MAX_APPS = 8

interface TopBarMetrics {
  /** 状态栏高度（自定义导航栏时由页面自行让出） */
  statusBar: number
  /** 与胶囊按钮等高的导航行高度 */
  height: number
  /** 右侧需要让出的距离（胶囊按钮 + 间距） */
  right: number
}

function getTopBarMetrics(): TopBarMetrics {
  if (process.env.TARO_ENV !== 'weapp') return { statusBar: 0, height: 52, right: 16 }
  try {
    const { statusBarHeight = 20, windowWidth } = Taro.getWindowInfo()
    const capsule = Taro.getMenuButtonBoundingClientRect()
    const gap = Math.max(capsule.top - statusBarHeight, 4)
    return {
      statusBar: statusBarHeight,
      height: capsule.height + gap * 2,
      right: windowWidth - capsule.left + 12,
    }
  } catch {
    return { statusBar: 20, height: 44, right: 108 }
  }
}

export default function IndexPage() {
  const user = useAuthStore((state) => state.user)
  const enabledModuleIds = useAuthStore((state) => state.enabledModuleIds)
  const menus = useModuleStore((state) => state.menus)
  const modulesLoading = useModuleStore((state) => state.loading)
  const modulesError = useModuleStore((state) => state.error)
  const modulesLoaded = useModuleStore((state) => state.loaded)
  const commonModuleIds = useModuleStore((state) => state.commonModuleIds)
  const commonConfigured = useModuleStore((state) => state.commonConfigured)
  const auth = useRequireAuth()
  const metrics = useHomeMetrics()
  const todos = useHomeTodos()
  const topBar = useMemo(getTopBarMetrics, [])
  const active = auth.ready && auth.loggedIn && auth.allowed

  // 模块菜单与指标各自带缓存 + 在途合并，useEffect 与 useDidShow 同时触发也只发一次请求
  const refresh = (force = false) =>
    Promise.all([
      useModuleStore.getState().load({ force }),
      metrics.load({ force }),
      todos.load(),
    ])

  useEffect(() => {
    if (active) void refresh()
  }, [active, user?.id, metrics.defs.length, todos.available])

  useDidShow(() => {
    if (active) void refresh()
  })

  usePullDownRefresh(async () => {
    try {
      if (active) await refresh(true)
    } finally {
      Taro.stopPullDownRefresh()
    }
  })

  const refreshMetrics = async () => {
    if (metrics.loading) return
    const hadData = Boolean(metrics.data)
    const ok = await metrics.load({ force: true })
    // 已有数据时失败不清空卡片，用轻提示告知；无数据时由卡片区展示错误与重试
    if (hadData && !ok) Taro.showToast({ title: '刷新失败，请稍后重试', icon: 'none' })
  }

  const modules = getAuthorizedMobileModules(menus, user?.permissions, enabledModuleIds)
  const allMenus = flattenMenus(menus)
  // 优先使用工作台里设置的常用应用；未设置时按注册顺序取有权限的应用
  const common = commonModuleIds.flatMap((id) => modules.filter((module) => module.id === id))
  const apps: FavoriteAppItem[] = (commonConfigured || common.length > 0 ? common : modules)
    .slice(0, MAX_APPS)
    .map((module) => {
      const menu = allMenus.find((candidate) => getMobileModule(candidate)?.id === module.id)
      return { id: module.id, name: module.name, icon: resolveHomeIcon(menu?.icon, module.icon) }
    })

  const openModule = (id: string) => {
    const module = modules.find((candidate) => candidate.id === id)
    if (module) navigateTo(`/${module.entry}`)
  }

  const getMetricDetail = (def: HomeMetricDef) => {
    const module = modules.find((candidate) => candidate.id === def.detailModuleId)
    return module ? () => navigateTo(`/${module.entry}`) : undefined
  }

  return (
    <PageContainer className={styles.home}>
      <View className={styles.home__topBar} style={{ paddingTop: `${topBar.statusBar}px` }}>
        <View
          className={styles.home__topRow}
          style={{ height: `${topBar.height}px`, paddingRight: `${topBar.right}px` }}
        >
          <View className={styles.home__brand}>
            <Image className={styles.home__logo} src={logo} mode="aspectFit" />
            <Text className={styles.home__brandName}>{APP_NAME}</Text>
          </View>
          <View
            className={styles.home__iconButton}
            hoverClass={styles['home__iconButton--pressed']}
            onClick={() => navigateTo(`/${SECONDARY_PAGES.messages}`)}
          >
            <HomeIcon name="bell" size={22} />
          </View>
        </View>
      </View>

      <HomeSection
        title="数据概览"
        extra={
          metrics.defs.length > 0 ? (
            <View
              className={styles.home__refresh}
              hoverClass={styles['home__refresh--pressed']}
              onClick={() => void refreshMetrics()}
            >
              <HomeIcon
                name="refresh"
                size={16}
                color="#86909C"
                strokeWidth={2}
                className={metrics.loading ? styles.home__spin : undefined}
              />
            </View>
          ) : null
        }
      >
        <DashboardMetrics
          defs={metrics.defs}
          data={metrics.data}
          loading={metrics.loading}
          error={metrics.error}
          onRetry={() => void metrics.load({ force: true })}
          getDetailAction={getMetricDetail}
        />
      </HomeSection>

      <HomeSection
        title="常用应用"
        extra={<SectionLink text="全部" onClick={() => switchTab(`/${TAB_PAGES.apps}`)} />}
      >
        <FavoriteApps
          apps={apps}
          loading={modulesLoading || !modulesLoaded}
          error={modulesError}
          onRetry={() => void useModuleStore.getState().load({ force: true })}
          onOpen={openModule}
        />
      </HomeSection>

      {todos.available ? (
        <HomeSection
          title="我的待办"
          extra={
            todos.listEntry ? (
              <SectionLink text="全部" onClick={() => navigateTo(`/${todos.listEntry}`)} />
            ) : null
          }
        >
          <TodoPreview
            items={todos.items}
            loaded={todos.loaded}
            loading={todos.loading}
            error={todos.error}
            onRetry={() => void todos.load()}
            onOpen={(item) => navigateTo(`/${item.entry}`)}
          />
        </HomeSection>
      ) : null}
    </PageContainer>
  )
}
