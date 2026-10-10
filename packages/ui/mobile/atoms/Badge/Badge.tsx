import { View, Text } from '@tarojs/components'

import styles from './Badge.module.scss'

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger'
export type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  count?: number
  max?: number
  className?: string
  children?: React.ReactNode
}

export function Badge({
  variant = 'default',
  size = 'sm',
  dot = false,
  count,
  max = 99,
  className,
  children,
}: BadgeProps) {
  if (dot) {
    const cls = [
      styles.aBadge__dot,
      styles[`aBadge__dot--${variant}`],
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ')
    return <View className={cls} />
  }

  if (typeof count === 'number') {
    const showCount = count > max ? `${max}+` : String(count)
    const cls = [
      styles.aBadge,
      styles[`aBadge--${variant}`],
      styles[`aBadge--${size}`],
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <View className={cls}>
        <Text className={styles.aBadge__count}>{showCount}</Text>
      </View>
    )
  }

  const cls = [
    styles.aBadge,
    styles[`aBadge--${variant}`],
    styles[`aBadge--${size}`],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <View className={cls}>{children}</View>
}

export default Badge
