import { Text } from '@tarojs/components'

import '@/styles/fonts-subset/icons.css'
import styles from './IconFont.module.scss'

export interface IconFontProps {
  name: string
  size?: number
  color?: string
  className?: string
}

export function IconFont({ name, size = 24, color, className }: IconFontProps) {
  const cls = [styles.icon, `icon--${name.toLowerCase()}`, className ?? ''].filter(Boolean).join(' ')
  const style: React.CSSProperties = {
    fontSize: `${size}px`,
    color: color ?? 'inherit',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return <Text className={cls} style={style} />
}

export default IconFont
