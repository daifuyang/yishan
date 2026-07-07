import { View, Text } from '@tarojs/components'

import { AppText } from '@/components/atoms'

import styles from './EmptyState.module.scss'

export interface EmptyStateProps {
  text?: string
  hint?: string
}

export function EmptyState({
  text = '暂无数据',
  hint,
}: EmptyStateProps) {
  return (
    <View className={styles.empty}>
      <View className={styles.empty__icon}>∅</View>
      <AppText size={14} variant="tertiary">
        {text}
      </AppText>
      {hint ? (
        <Text className={styles.empty__hint}>{hint}</Text>
      ) : null}
    </View>
  )
}

export default EmptyState
