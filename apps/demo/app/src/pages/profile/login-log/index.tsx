import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'

import { userApi } from '@/api'
import type { LoginLog } from '@/api/types'
import { AppText } from '@/components/atoms'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { ListItem } from '@/components/molecules'
import { useAuthStore } from '@/stores/auth'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'

import styles from './index.module.scss'

const PAGE_SIZE = 10

export default function ProfileLoginLog() {
  const userId = useAuthStore((state) => state.user?.id)
  const token = useAuthStore((state) => state.token)
  const auth = useRequireAuth()
  const [list, setList] = useState<LoginLog[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const generation = useRef(0)
  const retry = useRef({ page: 1, reset: true })

  const load = async (requestedPage: number, reset: boolean) => {
    const session = useAuthStore.getState()
    if (!session.bootstrapped || !session.user || !session.token || loadingRef.current) return
    const ownerId = session.user.id
    const requestToken = session.token
    const requestGeneration = generation.current
    const isCurrent = () => {
      const current = useAuthStore.getState()
      return (
        generation.current === requestGeneration &&
        current.user?.id === ownerId &&
        current.token === requestToken
      )
    }
    loadingRef.current = true
    setLoading(true)
    setError(null)
    retry.current = { page: requestedPage, reset }
    try {
      const items = await userApi.getMyLoginLogs({ page: requestedPage, pageSize: PAGE_SIZE })
      if (!isCurrent()) return
      setList((previous) => (reset ? items : [...previous, ...items]))
      setPage(requestedPage)
      setHasMore(items.length >= PAGE_SIZE)
    } catch (failure) {
      if (isCurrent()) setError(failure instanceof Error ? failure.message : '登录日志加载失败')
    } finally {
      if (isCurrent()) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    generation.current += 1
    loadingRef.current = false
    setList([])
    setError(null)
    setLoading(false)
    setPage(1)
    setHasMore(true)
    if (auth.ready && auth.allowed) void load(1, true)
    return () => {
      generation.current += 1
    }
  }, [auth.ready, auth.allowed, userId, token])

  usePullDownRefresh(() => {
    void load(1, true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (hasMore && !error) void load(page + 1, false)
  })

  return (
    <PageContainer>
      <View className={styles.logs__list}>
        {loading && list.length === 0 ? (
          <ListSkeleton />
        ) : list.length === 0 && !error ? (
          <EmptyState text="暂无登录记录" />
        ) : (
          list.map((log, index) => (
            <ListItem
              key={log.id}
              title={
                <Text
                  className={styles.logs__status}
                  data-tone={log.status === '1' ? 'success' : 'warning'}
                >
                  {log.status === '1' ? '登录成功' : '登录失败'}
                </Text>
              }
              value={`${formatDateTime(log.createdAt)} · ${log.ipAddress || '-'}`}
              bordered={index < list.length - 1}
            />
          ))
        )}
        {error ? (
          <ErrorState
            text={error}
            onRetry={() => void load(retry.current.page, retry.current.reset)}
          />
        ) : null}
      </View>
      {list.length > 0 ? (
        <View className={styles.logs__loading}>
          <AppText size={12} variant="tertiary">
            {loading ? '加载中…' : hasMore ? '上拉加载更多' : '没有更多了'}
          </AppText>
        </View>
      ) : null}
    </PageContainer>
  )
}
