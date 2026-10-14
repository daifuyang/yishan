import { Picker } from '@tarojs/components'
import { PickerValue } from './PickerRow'
import styles from './ManagementAtoms.module.scss'

export interface TimeFieldProps {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}

export function TimeField({ value, disabled, onChange }: TimeFieldProps) {
  return (
    <Picker className={styles.dateField} mode="time" value={value} disabled={disabled}
      onChange={(event) => {
        if (event.detail.value != null) onChange(String(event.detail.value))
      }}>
      <PickerValue value={value} placeholder="请选择时间" />
    </Picker>
  )
}
