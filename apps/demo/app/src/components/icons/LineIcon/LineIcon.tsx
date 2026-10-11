import { View } from '@tarojs/components'

import styles from './LineIcon.module.scss'

export type LineIconName = 'user' | 'shield' | 'bell' | 'settings' | 'info' | 'logOut' | 'chevronRight' | 'lock' | 'history' | 'eye' | 'eyeOff'

export interface LineIconProps {
  name: LineIconName
  size?: number
  /** 缺省继承父级文字色 */
  color?: string
  className?: string
}

export function LineIcon({ name, size = 20, color, className }: LineIconProps) {
  const style: React.CSSProperties = { width: `${size}px`, height: `${size}px` }
  if (color) style.color = color
  return <View className={[styles.icon, styles[name], className ?? ''].filter(Boolean).join(' ')} style={style} />
}

export default LineIcon
