import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'

import { AppText } from '@/components/atoms'
import { ListItem } from '@/components/molecules'
import { userApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import type { LoginLog } from '@/api/types'

import styles from './index.module.scss'

const PAGE_SIZE = 10

export default function ProfileLoginLog() {
  const [list, setList] = useState<LoginLog[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  useRequireAuth()

  const load = async (p: number, reset: boolean) => {
    setLoading(true)
    try {
      const data = await userApi.getMyLoginLogs({ page: p, pageSize: PAGE_SIZE })
      const items = data || []
      setList((prev) => (reset ? items : [...prev, ...items]))
      setPage(p)
      setHasMore(items.length >= PAGE_SIZE)
    } catch (_e) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1, true)
  }, [])

  usePullDownRefresh(() => {
    load(1, true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (hasMore && !loading) {
      load(page + 1, false)
    }
  })

  return (
    <View className="page-container">
      <View className={styles.logs__list}>
        {list.length === 0 && !loading ? (
          <View className={styles.logs__empty}>
            <AppText size={13} variant="tertiary">
              暂无登录记录
            </AppText>
          </View>
        ) : (
          list.map((log, idx) => (
            <View key={log.id}>
              <ListItem
                title={
                  <View className={styles.logs__title}>
                    <Text className={styles.logs__status} data-tone={log.status === '1' ? 'success' : 'warning'}>
                      {log.status === '1' ? '登录成功' : '登录失败'}
                    </Text>
                  </View>
                }
                value={`${formatDateTime(log.createdAt)} · ${log.ipAddress || '-'}`}
                showArrow={false}
                bordered={idx < list.length - 1}
              />
            </View>
          ))
        )}
      </View>

      {loading ? (
        <View className={styles.logs__loading}>
          <AppText size={12} variant="tertiary">
            加载中…
          </AppText>
        </View>
      ) : !hasMore && list.length > 0 ? (
        <View className={styles.logs__loading}>
          <AppText size={12} variant="tertiary">
            没有更多了
          </AppText>
        </View>
      ) : null}
    </View>
  )
}
