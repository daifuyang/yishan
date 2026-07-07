import { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import { AppText } from '@/components/atoms'
import { ListItem, SectionHeader } from '@/components/molecules'
import { DashboardHero, DashboardGrid, TabBar } from '@/components/organisms'
import { useAuthStore } from '@/stores/auth'
import { userApi, dashboardApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateTo } from '@/utils/router'
import { TAB_PAGES } from '@/constants/routes'
import type { LoginLog, DashboardStats } from '@/api/types'

import styles from './index.module.scss'

export default function IndexPage() {
  const user = useAuthStore((s) => s.user)
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<DashboardStats | undefined>()
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  useRequireAuth()

  const isAdmin = user?.roleIds && user.roleIds.some(id => {
    return true
  })

  const loadStats = useCallback(async () => {
    if (!isAdmin) return

    setStatsLoading(true)
    setStatsError(null)
    try {
      const data = await dashboardApi.getStats()
      setStats(data)
    } catch (err: any) {
      setStatsError('数据加载失败')
    } finally {
      setStatsLoading(false)
    }
  }, [isAdmin])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await userApi.getMyLoginLogs({ page: 1, pageSize: 5 })
      setLogs(data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const loadAll = async () => {
    await Promise.all([loadStats(), loadLogs()])
  }

  useEffect(() => {
    if (user) {
      loadAll()
    }
  }, [user?.id])

  useDidShow(() => {
    if (user) {
      loadAll()
    }
  })

  const handleRetry = () => {
    loadStats()
  }

  const handleSearch = () => {
    Taro.showToast({ title: '搜索功能开发中', icon: 'none' })
  }

  const handleNotice = () => {
    Taro.showToast({ title: '通知中心待接入', icon: 'none' })
  }

  const getDateText = () => {
    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const weekday = weekdays[now.getDay()]
    return `${month}月${day}日 ${weekday}`
  }

  return (
    <View className={`page-container ${styles.index}`}>
      <DashboardHero user={user!} dateText={getDateText()} />

      {isAdmin && (
        <DashboardGrid
          stats={stats}
          loading={statsLoading}
          error={statsError}
          onRetry={handleRetry}
        />
      )}

      <View className={styles.index__body}>
        <SectionHeader title="最近登录" showMore moreText="全部" />

        <View className={styles.index__list}>
          {loading && logs.length === 0 ? (
            <View className={styles.index__empty}>
              <AppText size={13} variant="tertiary">
                加载中…
              </AppText>
            </View>
          ) : logs.length === 0 ? (
            <View className={styles.index__empty}>
              <AppText size={13} variant="tertiary">
                暂无登录记录
              </AppText>
            </View>
          ) : (
            logs.map((log, idx) => (
              <View key={log.id}>
                <ListItem
                  title={
                    <View className="flex items-center gap-2">
                      <AppText size={15} ellipsis className="flex-1">
                        {log.status === '1' ? '登录成功' : '登录失败'}
                      </AppText>
                      <Text
                        className={styles.index__tag}
                        data-tone={log.status === '1' ? 'success' : 'warning'}
                      >
                        {log.status === '1' ? '成功' : '失败'}
                      </Text>
                    </View>
                  }
                  value={`${formatDateTime(log.createdAt)} · ${log.ipAddress || '-'}`}
                  showArrow={false}
                  bordered={idx < logs.length - 1}
                />
              </View>
            ))
          )}
        </View>

        <View
          className={styles.index__quick}
          onClick={() => navigateTo(`/${TAB_PAGES.apps}`)}
        >
          <AppText size={14} weight="medium">
            查看全部应用
          </AppText>
          <Text className={styles.index__arrow}>›</Text>
        </View>
      </View>
      <TabBar currentPath={TAB_PAGES.home} />
    </View>
  )
}
