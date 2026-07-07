import { View, Text } from '@tarojs/components'
import type { CurrentUser } from '@/api/types'
import styles from './DashboardHero.module.scss'

export interface DashboardHeroProps {
  user: CurrentUser
  dateText: string
}

export default function DashboardHero({ user, dateText }: DashboardHeroProps) {
  if (!user) return null

  return (
    <View className={styles.hero}>
      <View className={styles.hero__brand}>
        <Text className={styles.hero__icon}>⛰</Text>
        <Text className={styles.hero__title}>「移山」</Text>
        <Text className={styles.hero__slogan}>简单可依赖的后台基座</Text>
      </View>
      <View className={styles.hero__welcome}>
        <Text className={styles.hero__greeting}>Hi, </Text>
        <Text className={styles.hero__name}>{user.realName || user.nickname || user.username || '用户'}</Text>
      </View>
      <Text className={styles.hero__date}>{dateText}</Text>
    </View>
  )
}
