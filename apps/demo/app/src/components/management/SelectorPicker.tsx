import { Picker } from '@tarojs/components'
import type { ReactNode } from 'react'

export interface SelectorPickerProps {
  range: readonly string[]
  value?: number
  disabled?: boolean
  mode?: 'selector'
  className?: string
  title?: string
  children?: ReactNode
  onChange?: (event: { detail: { value: number } }) => void
}

export function SelectorPicker({ title: _title, range, onChange, ...props }: SelectorPickerProps) {
  return <Picker {...props} range={[...range]} mode="selector" onChange={(event) => {
    if (event.detail.value != null) onChange?.({ detail: { value: Number(event.detail.value) } })
  }} />
}
