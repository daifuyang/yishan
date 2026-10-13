import { View } from '@tarojs/components'

import { MetricCard, SurfaceCard } from '@/components/management'

import { formatMetricValue, type HomeMetricDef, type MetricSourceData } from '../home-metrics'
import { InlineState } from './HomeSection'
import styles from './DashboardMetrics.module.scss'

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
          <SurfaceCard key={def.key} className={styles.skeletonCard}>
            <View className={`${styles.skeleton} ${styles['skeleton--label']}`} />
            <View className={`${styles.skeleton} ${styles['skeleton--value']}`} />
          </SurfaceCard>
        ))}
      </View>
    )
  }
  return (
    <View className={styles.grid}>
      {defs.map((def) => {
        const value = formatMetricValue(def.pick(data))
        return (
          <MetricCard
            key={def.key}
            label={def.label}
            // 取值失败显示占位符，绝不伪装为 0
            value={value ?? '--'}
            auxiliary={value !== null ? def.unit : undefined}
            onClick={getDetailAction(def)}
          />
        )
      })}
    </View>
  )
}

export default DashboardMetrics
