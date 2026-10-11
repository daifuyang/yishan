import { Text, View } from '@tarojs/components'
import type { WorkbenchApp } from '@/modules/registry'
import { ApplicationIcon } from '@/components/ApplicationIcon'
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
          <ApplicationIcon id={app.id} icon={app.icon} />
          <Text className={styles.apps__label}>{app.name}</Text>
        </View>
      ))}
    </View>
  )
}
