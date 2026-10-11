import { View } from '@tarojs/components'
import { appIconBackground, appIconPalette } from './app-icons'
import styles from './index.module.scss'

export function ApplicationIcon({ id, icon }: { id: string; icon: string }) {
  const palette = appIconPalette(id)
  return (
    <View className={styles.tile} style={{ background: palette.background }}>
      <View
        className={styles.glyph}
        style={{ backgroundImage: appIconBackground(icon, palette.color) }}
      />
    </View>
  )
}
