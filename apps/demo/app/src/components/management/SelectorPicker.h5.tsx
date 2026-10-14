import type { SelectorPickerProps } from './SelectorPicker'
import { WeuiDateTimeField } from './WeuiDateTimeField.h5'

export function SelectorPicker({ range, value = 0, disabled, className, title = '请选择', children, onChange }: SelectorPickerProps) {
  return <WeuiDateTimeField mode="selector" range={range} value={String(value)}
    disabled={disabled} className={className} title={title}
    onChange={(next) => onChange?.({ detail: { value: Number(next) } })}>
    {children}
  </WeuiDateTimeField>
}
