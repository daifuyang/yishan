import { View, Text, type ITouchEvent } from '@tarojs/components'

import styles from './ListItem.module.scss'

export interface ListItemProps {
  icon?: React.ReactNode
  title: React.ReactNode
  value?: React.ReactNode
  showArrow?: boolean
  arrow?: string
  size?: 'md' | 'sm'
  bordered?: boolean
  className?: string
  onClick?: (e: ITouchEvent) => void
}

export function ListItem({
  icon,
  title,
  value,
  showArrow = false,
  arrow = '›',
  size = 'md',
  bordered = false,
  className,
  onClick,
}: ListItemProps) {
  const cls = [
    styles.mListItem,
    styles[`mListItem--${size}`],
    bordered ? styles['mListItem--bordered'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={cls} onClick={onClick}>
      {icon ? <View className={styles.mListItem__icon}>{icon}</View> : null}
      <View className={styles.mListItem__title}>{title}</View>
      {value !== undefined ? (
        <Text className={styles.mListItem__value}>{value}</Text>
      ) : null}
      {showArrow ? (
        <Text className={styles.mListItem__arrow}>{arrow}</Text>
      ) : null}
    </View>
  )
}

export default ListItem
