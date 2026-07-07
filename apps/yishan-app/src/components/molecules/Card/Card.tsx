import { View } from '@tarojs/components'

import styles from './Card.module.scss'

export interface CardProps {
  bordered?: boolean
  shadow?: boolean
  compact?: boolean
  padded?: boolean
  className?: string
  children?: React.ReactNode
  onClick?: (e: unknown) => void
}

export function Card({
  bordered = false,
  shadow = false,
  compact = false,
  padded = false,
  className,
  children,
  onClick,
}: CardProps) {
  const cls = [
    styles.mCard,
    bordered ? styles['mCard--bordered'] : '',
    shadow ? styles['mCard--shadow'] : '',
    compact ? styles['mCard--compact'] : '',
    padded ? styles['mCard--padded'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={cls} onClick={onClick as never}>
      {children}
    </View>
  )
}

export default Card
