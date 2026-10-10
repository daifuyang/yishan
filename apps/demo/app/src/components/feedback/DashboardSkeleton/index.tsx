import { View } from '@tarojs/components'
import styles from './DashboardSkeleton.module.scss'

export default function DashboardSkeleton() {
  return (
    <View className={styles.skeleton}>
      <View className={styles.skeleton__row}>
        <View className={styles.skeleton__card}>
          <View className={styles.skeleton__icon} />
          <View className={styles.skeleton__value} />
          <View className={styles.skeleton__label} />
        </View>
        <View className={styles.skeleton__card}>
          <View className={styles.skeleton__icon} />
          <View className={styles.skeleton__value} />
          <View className={styles.skeleton__label} />
        </View>
      </View>
      <View className={styles.skeleton__row}>
        <View className={styles.skeleton__card}>
          <View className={styles.skeleton__icon} />
          <View className={styles.skeleton__value} />
          <View className={styles.skeleton__label} />
        </View>
        <View className={styles.skeleton__card}>
          <View className={styles.skeleton__icon} />
          <View className={styles.skeleton__value} />
          <View className={styles.skeleton__label} />
        </View>
      </View>
    </View>
  )
}
