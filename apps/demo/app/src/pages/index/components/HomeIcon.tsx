import { View } from '@tarojs/components'

import { type HomeIconName, homeIconBackground } from '../home-icons'

export interface HomeIconProps {
  name: HomeIconName
  size?: number
  color?: string
  strokeWidth?: number
  className?: string
}

/** 首页线性图标：背景图渲染，小程序与 H5 行为一致 */
export function HomeIcon({
  name,
  size = 20,
  color = '#1D2129',
  strokeWidth = 1.75,
  className,
}: HomeIconProps) {
  return (
    <View
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        backgroundImage: homeIconBackground(name, color, strokeWidth),
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: '100% 100%',
      }}
    />
  )
}

export default HomeIcon
