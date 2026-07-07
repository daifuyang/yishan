import { View, Text } from '@tarojs/components'

import styles from './Tag.module.scss'

export type TagVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger'
export type TagSize = 'sm' | 'md'

export interface TagProps {
  variant?: TagVariant
  size?: TagSize
  className?: string
  children?: React.ReactNode
}

export function Tag({
  variant = 'default',
  size = 'sm',
  className,
  children,
}: TagProps) {
  const cls = [
    styles.aTag,
    styles[`aTag--${variant}`],
    styles[`aTag--${size}`],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={cls}>
      <Text className={styles.aTag__text}>{children}</Text>
    </View>
  )
}

export default Tag
