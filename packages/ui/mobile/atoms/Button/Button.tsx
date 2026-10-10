import { Text, type ITouchEvent } from '@tarojs/components'

import styles from './Button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'text' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  disabled?: boolean
  loading?: boolean
  className?: string
  onClick?: (e: ITouchEvent) => void
  children?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  loading = false,
  className,
  onClick,
  children,
}: ButtonProps) {
  const cls = [
    styles.aButton,
    styles[`aButton--${variant}`],
    styles[`aButton--${size}`],
    block ? styles['aButton--block'] : '',
    disabled || loading ? styles['aButton--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Text
      className={cls}
      onClick={disabled || loading ? undefined : onClick}
    >
      {loading ? <Text className={styles.aButton__spinner} /> : null}
      {children}
    </Text>
  )
}

export default Button
