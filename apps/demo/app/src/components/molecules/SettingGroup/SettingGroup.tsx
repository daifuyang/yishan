import { Text, View } from '@tarojs/components'

import styles from './SettingGroup.module.scss'

export interface SettingGroupProps {
  title?: string
  children: React.ReactNode
}

export function SettingGroup({ title, children }: SettingGroupProps) {
  return (
    <View className={styles.group}>
      {title ? <Text className={styles.group__title}>{title}</Text> : null}
      <View className={styles.group__body}>{children}</View>
    </View>
  )
}

export default SettingGroup
