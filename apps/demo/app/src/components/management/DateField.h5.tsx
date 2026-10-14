import type { DateFieldProps } from './DateField'
import { WeuiDateTimeField } from './WeuiDateTimeField.h5'

export function DateField(props: DateFieldProps) {
  return <WeuiDateTimeField {...props} mode="date" />
}
