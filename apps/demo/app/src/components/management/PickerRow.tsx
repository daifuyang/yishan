import { Text, View } from '@tarojs/components'

import { LineIcon } from './LineIcon'

import styles from './ManagementAtoms.module.scss'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

/**
 * 行尾箭头颜色。LineIcon 把 stroke 直接写进 data-URI 背景图，图片是独立文档、
 * 读不到宿主页面的 CSS 变量（var() 在 SVG 里会解析失败导致整条线不画），
 * 所以图标颜色只能以字面量传入。此值镜像 tokens.scss 的 --color-text-quaternary，
 * 与 FormLayout / DetailLayout / ManagementList 的 › 同色。
 */
const CHEVRON_COLOR = '#C9CDD4'

export interface PickerValueProps {
  value: string
  /** 空值时显示的占位文案，弱化为三级灰 */
  placeholder: string
}

/**
 * 选择行的取值单元：占满标签右侧、右对齐、空值走占位弱化。
 * PickerRow 与 DateField 共用它，两者才是同一套视觉契约。
 */
export function PickerValue({ value, placeholder }: PickerValueProps) {
  return (
    <View className={styles.pickerRow__value}>
      <Text className={value ? undefined : styles.pickerRow__placeholder}>{value || placeholder}</Text>
    </View>
  )
}

export interface PickerRowProps {
  label: string
  value: string
  placeholder: string
  /** 不可点击：整行降到三级灰，行高不变 */
  disabled?: boolean
  /** 行尾 ›：选择行是跳转/唤起下一级，显式开启 */
  arrow?: boolean
  onClick?: () => void
}

/**
 * 统一的选择行：左标签（76px 固定列）+ 右取值 + 可选行尾 ›。
 * 取值靠 flex: 1 推到行尾，箭头是行的最后一个子节点 —— 塞进取值里会跟着
 * 取值的盒子居中，读起来像控件内部的装饰。
 *
 * 行自带横向内边距与分隔线，可直接放进 FormSection 当一整行使用。
 */
export function PickerRow({
  label,
  value,
  placeholder,
  disabled = false,
  arrow = false,
  onClick,
}: PickerRowProps) {
  return (
    <View
      className={cx(styles.pickerRow, disabled && styles['pickerRow--disabled'])}
      onClick={disabled ? undefined : onClick}
      hoverClass={!disabled && onClick ? styles['pickerRow--pressed'] : undefined}
      aria-label={label}
      aria-disabled={disabled}
    >
      <Text className={styles.pickerRow__label}>{label}</Text>
      <PickerValue value={value} placeholder={placeholder} />
      {arrow ? (
        <View className={styles.pickerRow__arrow}>
          <LineIcon name="chevronRight" size={16} color={CHEVRON_COLOR} />
        </View>
      ) : null}
    </View>
  )
}
