import { View, Text } from '@tarojs/components'

import { AppText } from '@/components/atoms'

import styles from './Loading.module.scss'

export interface LoadingProps {
  text?: string
}

export function Loading({ text = '加载中…' }: LoadingProps) {
  return (
    <View className={styles.loading}>
      <Text className={styles.loading__dot}>·</Text>
      <Text className={styles.loading__dot}>·</Text>
      <Text className={styles.loading__dot}>·</Text>
      <AppText size={13} variant="tertiary" className={styles.loading__text}>
        {text}
      </AppText>
    </View>
  )
}

export default Loading
