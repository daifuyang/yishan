import { View, Text } from '@tarojs/components'
import { IconFont } from '@/components/icons'
import styles from './StatCard.module.scss'

export interface StatCardProps {
  icon: string
  value: number | string
  label: string
  onClick?: () => void
}

export default function StatCard({ icon, value, label, onClick }: StatCardProps) {
  return (
    <View className={styles.card} onClick={onClick}>
      <View className={styles.card__icon}>
        <IconFont name={icon} size={20} color='var(--color-primary)' />
      </View>
      <Text className={styles.card__value}>{value}</Text>
      <Text className={styles.card__label}>{label}</Text>
    </View>
  )
}
