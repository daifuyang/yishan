import { View } from '@tarojs/components'

import styles from './Checkbox.module.scss'
import { LineIcon } from './LineIcon'

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
 * 统一的多选框：22px 圆角方框 + 14px 勾。
 * 曾经各页面各写一套（圆形 20px、文字 ✓、胶囊形），视觉互相打架，
 * 因此收敛到这里，跨页面复用。
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
        disabled
          ? undefined
          : (event) => {
              event.stopPropagation()
              onClick?.(event)
            }
      }
    >
      {indeterminate ? (
        <View className={styles.dash} />
      ) : checked ? (
        <LineIcon name="check" size={14} color="#FFFFFF" />
      ) : null}
    </View>
  )
}