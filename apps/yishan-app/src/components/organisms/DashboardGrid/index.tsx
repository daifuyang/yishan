import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import StatCard from '../StatCard'
import DashboardSkeleton from '../../feedback/DashboardSkeleton'
import type { DashboardStats } from '@/api/types'
import styles from './DashboardGrid.module.scss'

export interface DashboardGridProps {
  stats?: DashboardStats
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export default function DashboardGrid({ stats, loading, error, onRetry }: DashboardGridProps) {
  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <View className={styles.error}>
        <Text className={styles.error__text}>{error}</Text>
        {onRetry && (
          <Text className={styles.error__retry} onClick={onRetry}>
            点击重试
          </Text>
        )}
      </View>
    )
  }

  if (!stats) {
    return null
  }

  const handleCardClick = (type: 'users' | 'depts' | 'login' | 'online') => {
    const routes: Record<string, string> = {
      users: '/pages/system/user/index',
      depts: '/pages/system/dept/index',
      login: '/pages/system/login-log/index',
      online: '/pages/system/login-log/index',
    }
    Taro.navigateTo({ url: routes[type] })
  }

  return (
    <View className={styles.grid}>
      <View className={styles.grid__row}>
        <StatCard
          icon='user'
          value={stats.userTotal}
          label='用户总数'
          onClick={() => handleCardClick('users')}
        />
        <StatCard
          icon='dept'
          value={stats.deptTotal}
          label='部门总数'
          onClick={() => handleCardClick('depts')}
        />
      </View>
      <View className={styles.grid__row}>
        <StatCard
          icon='login'
          value={stats.todayLogin}
          label='今日登录'
          onClick={() => handleCardClick('login')}
        />
        <StatCard
          icon='online'
          value={stats.online}
          label='在线用户'
          onClick={() => handleCardClick('online')}
        />
      </View>
    </View>
  )
}
