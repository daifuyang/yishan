import { Text } from '@tarojs/components'

import styles from './Text.module.scss'

export type TextVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'quaternary'
  | 'inverse'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'

export type TextSize = 10 | 11 | 12 | 13 | 14 | 15 | 16 | 18 | 20 | 24 | 28 | 32

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold'

export interface TextProps {
  variant?: TextVariant
  size?: TextSize
  weight?: TextWeight
  ellipsis?: boolean
  lines?: 1 | 2
  className?: string
  children?: React.ReactNode
}

export function AppText({
  variant = 'primary',
  size = 14,
  weight = 'regular',
  ellipsis = false,
  lines,
  className,
  children,
}: TextProps) {
  const cls = [
    styles.aText,
    styles[`aText--v-${variant}`],
    styles[`aText--s-${size}`],
    styles[`aText--w-${weight}`],
    ellipsis ? styles['aText--ellipsis'] : '',
    lines === 2 ? styles['aText--clamp-2'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <Text className={cls}>{children}</Text>
}

export default AppText
