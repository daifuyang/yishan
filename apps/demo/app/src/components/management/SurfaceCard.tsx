import { View } from '@tarojs/components'
import type { ReactNode } from 'react'

import styles from './ManagementAtoms.module.scss'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface SurfaceCardProps {
  children: ReactNode
  /**
   * 无 hero 页的第一块内容：由卡片自己补 16px 页顶距。
   * 以前这条间距在 quickstart / region / security 三份页面 SCSS 里各复制了一遍。
   */
  lead?: boolean
  onClick?: () => void
  className?: string
}

/** 卡片型页面（首页、工作台）的白色内容块：圆角与 token 底色，本身不带内边距。 */
export function SurfaceCard({ children, lead = false, onClick, className = '' }: SurfaceCardProps) {
  return (
    <View
      className={cx(styles.surfaceCard, lead && styles['surfaceCard--lead'], className)}
      onClick={onClick}
      hoverClass={onClick ? styles['surfaceCard--pressed'] : undefined}
    >
      {children}
    </View>
  )
}
