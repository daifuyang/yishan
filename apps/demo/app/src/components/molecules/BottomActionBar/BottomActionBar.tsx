import { View } from '@tarojs/components'

import styles from './BottomActionBar.module.scss'

export interface BottomActionBarProps {
  children?: React.ReactNode
  /** 是否显示上方分隔线 */
  bordered?: boolean
  className?: string
}

/**
 * 底部固定操作栏
 *  - 用于表单保存 / 详情页底部按钮等
 *  - 自动适配底部安全区
 */
export function BottomActionBar({
  children,
  bordered = true,
  className,
}: BottomActionBarProps) {
  const cls = [
    styles.mBottomActionBar,
    bordered ? styles['mBottomActionBar--bordered'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={styles.mBottomActionBar__wrap}>
      <View className={cls}>{children}</View>
    </View>
  )
}

export default BottomActionBar
