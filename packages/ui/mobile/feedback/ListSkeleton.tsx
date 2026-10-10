import { View } from '@tarojs/components'

import styles from './ListSkeleton.module.scss'

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View className={styles.list} aria-label="加载中">
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton rows are stateless placeholders with fixed positions.
        <View className={styles.row} key={`loading-${index}`}>
          <View className={styles.title} />
          <View className={styles.detail} />
        </View>
      ))}
    </View>
  )
}

export default ListSkeleton
