import { Text, View } from '@tarojs/components'

import { SurfaceCard } from './SurfaceCard'

import styles from './ManagementAtoms.module.scss'

export interface MetricCardProps {
  /** 指标名 */
  label: string
  /** 已格式化的数值；取不到时由调用方传 '--'，不要伪装成 0 */
  value: string
  /** 辅助文案：单位、变化量等 */
  auxiliary?: string
  onClick?: () => void
}

/** 仪表盘指标卡：复用 SurfaceCard 的白色内容块，只保留指标所需的标题、数值和辅助文案。 */
export function MetricCard({ label, value, auxiliary, onClick }: MetricCardProps) {
  return (
    <SurfaceCard className={styles.metric} onClick={onClick}>
      <Text className={styles.metric__label}>{label}</Text>
      <View className={styles.metric__body}>
        <Text className={styles.metric__value}>{value}</Text>
        {auxiliary ? <Text className={styles.metric__auxiliary}>{auxiliary}</Text> : null}
      </View>
    </SurfaceCard>
  )
}
