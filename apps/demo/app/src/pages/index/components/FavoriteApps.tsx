import { Text, View } from '@tarojs/components'

import { ApplicationIcon } from '@/components/ApplicationIcon'
import { SurfaceCard } from '@/components/management'
import { InlineState } from './HomeSection'
import styles from './FavoriteApps.module.scss'

export interface FavoriteAppItem {
  id: string
  name: string
  icon: string
}

export interface FavoriteAppsProps {
  apps: readonly FavoriteAppItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onOpen: (id: string) => void
}

const SKELETON_KEYS = ['a', 'b', 'c', 'd']

export function FavoriteApps({ apps, loading, error, onRetry, onOpen }: FavoriteAppsProps) {
  if (error && apps.length === 0) return <InlineState text={error} onRetry={onRetry} />
  if (loading && apps.length === 0) {
    return (
      <SurfaceCard className={styles.panel}>
        {SKELETON_KEYS.map((key) => (
          <View key={key} className={styles.app}>
            <View className={`${styles.app__icon} ${styles['app__icon--skeleton']}`} />
            <View className={styles.app__labelSkeleton} />
          </View>
        ))}
      </SurfaceCard>
    )
  }
  if (apps.length === 0) return <InlineState text="暂无可用应用，请联系管理员开通" />
  return (
    <SurfaceCard className={styles.panel}>
      {apps.map((app) => (
        <View
          key={app.id}
          className={styles.app}
          hoverClass={styles['app--pressed']}
          onClick={() => onOpen(app.id)}
        >
          <ApplicationIcon id={app.id} icon={app.icon} />
          <Text className={styles.app__label}>{app.name}</Text>
        </View>
      ))}
    </SurfaceCard>
  )
}

export default FavoriteApps
