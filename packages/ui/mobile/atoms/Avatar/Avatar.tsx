import { View, Image, Text } from '@tarojs/components'

import styles from './Avatar.module.scss'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  src?: string
  name?: string
  size?: AvatarSize
  shape?: 'circle' | 'square'
  className?: string
}

function getInitial(name?: string): string {
  if (!name) return ''
  return name.trim().charAt(0).toUpperCase()
}

export function Avatar({
  src,
  name,
  size = 'md',
  shape = 'circle',
  className,
}: AvatarProps) {
  const cls = [
    styles.aAvatar,
    styles[`aAvatar--${size}`],
    shape === 'square' ? styles['aAvatar--square'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  if (src) {
    return (
      <View className={cls}>
        <Image className={styles.aAvatar__img} src={src} mode="aspectFill" />
      </View>
    )
  }

  return (
    <View className={cls}>
      <Text className={styles.aAvatar__initial}>{getInitial(name)}</Text>
    </View>
  )
}

export default Avatar
