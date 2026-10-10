import { View } from '@tarojs/components'

/**
 * 登录页线性图标（Lucide, ISC License）。
 * 以 SVG data URI 作为背景图渲染，不依赖 DOM/SVG 组件，微信小程序与 H5 一致。
 */
const NODES = {
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  x: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
} as const

export type LoginIconName = keyof typeof NODES

const cache = new Map<string, string>()

function background(name: LoginIconName, color: string, strokeWidth: number): string {
  const key = `${name}|${color}|${strokeWidth}`
  const hit = cache.get(key)
  if (hit) return hit
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${NODES[name]}</svg>`
  const value = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  cache.set(key, value)
  return value
}

export interface LoginIconProps {
  name: LoginIconName
  size?: number
  color?: string
  strokeWidth?: number
}

export function LoginIcon({ name, size = 18, color = '#86909C', strokeWidth = 1.75 }: LoginIconProps) {
  return (
    <View
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        backgroundImage: background(name, color, strokeWidth),
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: '100% 100%',
      }}
    />
  )
}

export default LoginIcon
