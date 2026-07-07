import { View, Text, type ITouchEvent } from '@tarojs/components'

import styles from './GridItem.module.scss'

export type GridItemTone = 'primary' | 'gray' | 'success' | 'warning' | 'danger'

export interface GridItemProps {
  icon: React.ReactNode
  label: React.ReactNode
  tone?: GridItemTone
  badge?: React.ReactNode
  className?: string
  onClick?: (e: ITouchEvent) => void
}

export function GridItem({
  icon,
  label,
  tone = 'primary',
  badge,
  className,
  onClick,
}: GridItemProps) {
  const cls = [styles.mGridItem, className ?? ''].filter(Boolean).join(' ')

  const wrapCls = [
    styles.mGridItem__iconWrap,
    styles[`mGridItem__iconWrap--${tone}`],
  ].join(' ')

  const iconCls = [
    styles.mGridItem__icon,
    styles[`mGridItem__icon--${tone}`],
  ].join(' ')

  return (
    <View className={cls} onClick={onClick}>
      <View className={wrapCls}>
        <Text className={iconCls}>{icon}</Text>
        {badge ? <View className={styles.mGridItem__badge}>{badge}</View> : null}
      </View>
      <Text className={styles.mGridItem__label}>{label}</Text>
    </View>
  )
}

export default GridItem
