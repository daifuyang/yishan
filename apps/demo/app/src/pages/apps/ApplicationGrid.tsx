import { Text, View } from '@tarojs/components'
import type { WorkbenchApp } from '@/modules/registry'
import { appIconBackground } from './app-icons'
import styles from './index.module.scss'

export function ApplicationGrid({
  apps,
  onOpen,
}: {
  apps: readonly WorkbenchApp[]
  onOpen: (id: string) => void
}) {
  return (
    <View className={styles.apps__grid}>
      {apps.map((app) => (
        <View
          key={app.id}
          className={styles.apps__item}
          hoverClass={styles.apps__pressed}
          onClick={() => onOpen(app.id)}
          aria-label={app.name}
        >
          <View className={styles.apps__iconWrap}>
            <View
              style={{
                width: '24px',
                height: '24px',
                backgroundImage: appIconBackground(app.icon),
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% 100%',
              }}
            />
          </View>
          <Text className={styles.apps__label}>{app.name}</Text>
        </View>
      ))}
    </View>
  )
}
