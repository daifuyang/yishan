import { View } from '@tarojs/components'

import { AppText } from '../atoms/Text'

import styles from './Loading.module.scss'

export interface LoadingProps {
  text?: string
}

export function Loading({ text = '加载中…' }: LoadingProps) {
  return (
    <View className={styles.loading} role="status" aria-live="polite">
      <View className={styles.loading__spinner} aria-hidden="true">
        <View className={styles.loading__cap} />
      </View>
      <AppText size={13} variant="tertiary">
        {text}
      </AppText>
    </View>
  )
}

export default Loading
