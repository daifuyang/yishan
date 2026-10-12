export interface DictionaryFormValues {
  name: string
  type: string
  label: string
  value: string
  status: string
  sort: string
  remark: string
  tag: string
  isDefault: boolean
}

function basePayload(values: DictionaryFormValues) {
  const sort_order = Number(values.sort)
  if (!values.sort.trim() || !Number.isInteger(sort_order) || sort_order < 0)
    throw new Error('排序须为非负整数')
  if (values.status !== '0' && values.status !== '1') throw new Error('请选择有效状态')
  if (values.remark.length > 255) throw new Error('备注最多 255 字')
  return {
    status: values.status === '1' ? (1 as const) : (0 as const),
    sort_order,
    remark: values.remark,
  }
}

function required(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 100) throw new Error(`${label}须为 1–100 字`)
  return trimmed
}

export function dictionaryTypePayload(values: DictionaryFormValues) {
  return {
    name: required(values.name, '字典名称'),
    type: required(values.type, '字典类型'),
    ...basePayload(values),
  }
}

export function dictionaryDataPayload(values: DictionaryFormValues, typeId: number) {
  if (!Number.isInteger(typeId) || typeId < 1) throw new Error('字典类型无效')
  if (values.tag.length > 50) throw new Error('标签样式最多 50 字')
  return {
    typeId,
    label: required(values.label, '字典标签'),
    value: required(values.value, '字典键值'),
    ...basePayload(values),
    tag: values.tag,
    isDefault: values.isDefault,
  }
}

export function dictionaryDraft(
  record?: import('@/api/admin/types').AdminDictType | import('@/api/admin/types').AdminDictData,
): DictionaryFormValues {
  return {
    name: record && 'name' in record ? record.name : '',
    type: record?.type ?? '',
    label: record && 'label' in record ? record.label : '',
    value: record && 'value' in record ? record.value : '',
    status: String(record?.status ?? 1),
    sort: String(record?.sort_order ?? 0),
    remark: record?.remark ?? '',
    tag: record && 'tag' in record ? (record.tag ?? '') : '',
    isDefault: record && 'isDefault' in record ? record.isDefault : false,
  }
}
