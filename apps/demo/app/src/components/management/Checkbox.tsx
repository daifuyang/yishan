import { View } from '@tarojs/components'

import styles from './Checkbox.module.scss'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface CheckboxProps {
  checked: boolean
  /** 半选：父节点下部分子节点被选中 */
  indeterminate?: boolean
  /** 只读态（不可交互、不带 checked 语义） */
  disabled?: boolean
  className?: string
  'aria-label'?: string
  onClick?: (event: { stopPropagation: () => void }) => void
}

/**
 * 统一的多选框：22px 圆角方框，白底 + 主色勾。
 * 曾经各页面各写一套（圆形 20px、文字 ✓、实心蓝块），视觉互相打架，
 * 因此收敛到这里，跨页面复用。
 *
 * 勾用 CSS 边框画而非 SVG 图标，颜色才能跟随 var(--color-primary)。
 */
export function Checkbox({
  checked,
  indeterminate = false,
  disabled = false,
  className = '',
  onClick,
  ...rest
}: CheckboxProps) {
  const active = checked || indeterminate
  return (
    <View
      className={cx(styles.check, active && styles['check--active'], className)}
      aria-label={rest['aria-label']}
      aria-checked={disabled ? undefined : indeterminate ? 'mixed' : checked}
      onClick={
        // 只有自带处理函数才拦截冒泡。不传 onClick 时必须让点击冒泡到整行 ——
        // 否则点在框上会「既不自己响应、又不冒泡」，看起来就是失灵。
        disabled || !onClick
          ? undefined
          : (event) => {
              event.stopPropagation()
              onClick(event)
            }
      }
    >
      {indeterminate ? <View className={styles.dash} /> : checked ? <View className={styles.tick} /> : null}
    </View>
  )
}