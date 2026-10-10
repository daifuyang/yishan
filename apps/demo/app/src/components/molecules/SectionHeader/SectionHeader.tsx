import { View, Text, type ITouchEvent } from '@tarojs/components'

import styles from './SectionHeader.module.scss'

export interface SectionHeaderProps {
  title: React.ReactNode
  icon?: React.ReactNode
  extra?: React.ReactNode
  moreText?: string
  showMore?: boolean
  className?: string
  onMoreClick?: (e: ITouchEvent) => void
}

export function SectionHeader({
  title,
  icon,
  extra,
  moreText = '更多',
  showMore = false,
  className,
  onMoreClick,
}: SectionHeaderProps) {
  return (
    <View className={[styles.mSection, className ?? ''].filter(Boolean).join(' ')}>
      <View className={styles.mSection__title}>
        {icon ? <Text className={styles.mSection__icon}>{icon}</Text> : null}
        <Text className={styles.mSection__titleText}>{title}</Text>
      </View>
      {extra ? <View className={styles.mSection__extra}>{extra}</View> : null}
      {showMore ? (
        <Text className={styles.mSection__more} onClick={onMoreClick}>
          {moreText} ›
        </Text>
      ) : null}
    </View>
  )
}

export default SectionHeader
