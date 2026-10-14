import type { TimeFieldProps } from './TimeField'
import { WeuiDateTimeField } from './WeuiDateTimeField.h5'

export function TimeField(props: TimeFieldProps) {
  return <WeuiDateTimeField {...props} mode="time" />
}
