import { Text, View } from '@tarojs/components'

import { formatMetricValue, type HomeMetricDef, type MetricSourceData } from '../home-metrics'
import { HomeIcon } from './HomeIcon'
import { InlineState } from './HomeSection'
import styles from './DashboardMetrics.module.scss'

export interface MetricCardProps {
  def: HomeMetricDef
  value: string | null
  onClick?: () => void
}

export function MetricCard({ def, value, onClick }: MetricCardProps) {
  return (
    <View
      className={styles.card}
      hoverClass={onClick ? styles['card--pressed'] : 'none'}
      onClick={onClick}
    >
      <View className={styles.card__head}>
        <Text className={styles.card__label}>{def.label}</Text>
        <HomeIcon name={def.icon} size={18} color="#1677FF" />
      </View>
      <View className={styles.card__body}>
        {/* 取值失败显示占位符，绝不伪装为 0 */}
        <Text className={styles.card__value}>{value ?? '--'}</Text>
        {value !== null && def.unit ? <Text className={styles.card__unit}>{def.unit}</Text> : null}
        {onClick ? <Text className={styles.card__chevron}>›</Text> : null}
      </View>
    </View>
  )
}

export interface DashboardMetricsProps {
  defs: readonly HomeMetricDef[]
  data: MetricSourceData | null
  loading: boolean
  error: string | null
  onRetry: () => void
  getDetailAction: (def: HomeMetricDef) => (() => void) | undefined
}

export function DashboardMetrics({
  defs,
  data,
  loading,
  error,
  onRetry,
  getDetailAction,
}: DashboardMetricsProps) {
  if (defs.length === 0) return <InlineState text="暂无可查看的数据指标" />
  if (!data && error) return <InlineState text={error} onRetry={onRetry} />
  if (!data) {
    return (
      <View className={styles.grid} aria-label={loading ? '加载中' : undefined}>
        {defs.map((def) => (
          <View key={def.key} className={styles.card}>
            <View className={`${styles.skeleton} ${styles['skeleton--label']}`} />
            <View className={`${styles.skeleton} ${styles['skeleton--value']}`} />
          </View>
        ))}
      </View>
    )
  }
  return (
    <View className={styles.grid}>
      {defs.map((def) => (
        <MetricCard
          key={def.key}
          def={def}
          value={formatMetricValue(def.pick(data))}
          onClick={getDetailAction(def)}
        />
      ))}
    </View>
  )
}

export default DashboardMetrics
