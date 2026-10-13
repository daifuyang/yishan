import { Picker } from '@tarojs/components'

import { PickerValue } from './PickerRow'

import styles from './ManagementAtoms.module.scss'

export interface DateFieldProps {
  /** YYYY-MM-DD；空串表示未选择 */
  value: string
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}

/**
 * 日期取值行：封装 Taro 的 date Picker，把事件里的日期字符串原样回传。
 *
 * 用作 FormField 的控件（标签由 FormField 提供），取值单元复用 PickerRow
 * 的同一套视觉契约，不会出现「同一张表单两种取值对齐」。
 */
export function DateField({ value, placeholder = '请选择', disabled = false, onChange }: DateFieldProps) {
  return (
    <Picker
      className={styles.dateField}
      mode="date"
      value={value}
      disabled={disabled}
      onChange={(event) => {
        // 事件里没有 value 时直接 `String(...)` 会把字符串 "undefined" 回传给调用方，
        // 所以先判空再回传（和 FormLayout 的枚举 picker 同一套防法：拿不到就不回调）。
        const next = event.detail.value
        if (next == null) return
        onChange(String(next))
      }}
    >
      <PickerValue value={value} placeholder={placeholder} />
    </Picker>
  )
}
