import { View, Text, Input, Textarea, Switch, type ITouchEvent } from '@tarojs/components'

import { AppText } from '@/components/atoms'

import styles from './FormField.module.scss'

export interface FormFieldBaseProps {
  label?: React.ReactNode
  /** 必填星号 */
  required?: boolean
  /** 错误提示 */
  error?: string
  /** 整行说明文字（在输入下方） */
  hint?: string
  /** 字段名（用于 form 取值） */
  name?: string
  className?: string
  /** 右侧额外内容（按钮等） */
  extra?: React.ReactNode
}

/** 表单输入类型：与 Taro Input.type 对齐（去掉了 alipay 独占的 numberpad/digitpad/idcardpad） */
export type FormFieldInputType =
  | 'text'
  | 'number'
  | 'idcard'
  | 'digit'
  | 'safe-password'
  | 'nickname'
  | 'phone'

export type FormFieldProps =
  | (FormFieldBaseProps & {
      type: 'input'
      value?: string
      placeholder?: string
      inputType?: FormFieldInputType
      maxLength?: number
      disabled?: boolean
      password?: boolean
      onInput?: (value: string) => void
      onChange?: (value: string) => void
      onFocus?: () => void
      onBlur?: () => void
    })
  | (FormFieldBaseProps & {
      type: 'textarea'
      value?: string
      placeholder?: string
      maxLength?: number
      autoHeight?: boolean
      disabled?: boolean
      onInput?: (value: string) => void
    })
  | (FormFieldBaseProps & {
      type: 'switch'
      checked?: boolean
      disabled?: boolean
      onChange?: (checked: boolean) => void
    })
  | (FormFieldBaseProps & {
      type: 'picker'
      value?: React.ReactNode
      placeholder?: string
      disabled?: boolean
      onClick?: (e: ITouchEvent) => void
    })

/** phone 在 Taro 标准 Input.type 里没有，映射到 number */
function resolveInputType(t: FormFieldInputType): 'text' | 'number' | 'idcard' | 'digit' | 'safe-password' | 'nickname' {
  if (t === 'phone') return 'number'
  return t
}

export function FormField(props: FormFieldProps) {
  const {
    label,
    required,
    error,
    hint,
    className,
    extra,
  } = props

  const wrapCls = [
    styles.mFormField,
    error ? styles['mFormField--error'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={wrapCls}>
      {label !== undefined ? (
        <View className={styles.mFormField__label}>
          {required ? (
            <Text className={styles.mFormField__required}>*</Text>
          ) : null}
          <AppText size={14} variant="secondary">
            {label}
          </AppText>
        </View>
      ) : null}
      <View className={styles.mFormField__control}>
        {renderControl(props)}
        {extra ? (
          <View className={styles.mFormField__extra}>{extra}</View>
        ) : null}
      </View>
      {error ? (
        <Text className={styles.mFormField__errorText}>{error}</Text>
      ) : hint ? (
        <Text className={styles.mFormField__hintText}>{hint}</Text>
      ) : null}
    </View>
  )
}

function renderControl(props: FormFieldProps) {
  switch (props.type) {
    case 'input':
      return (
        <Input
          className={styles.mFormField__input}
          type={resolveInputType(props.inputType ?? 'text')}
          value={props.value ?? ''}
          placeholder={props.placeholder}
          placeholderClass={styles.mFormField__placeholder}
          maxlength={props.maxLength}
          password={props.password}
          disabled={props.disabled}
          onInput={(e) => {
            props.onInput?.(e.detail.value)
            props.onChange?.(e.detail.value)
          }}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
        />
      )
    case 'textarea':
      return (
        <Textarea
          className={styles.mFormField__textarea}
          value={props.value ?? ''}
          placeholder={props.placeholder}
          placeholderClass={styles.mFormField__placeholder}
          maxlength={props.maxLength}
          autoHeight={props.autoHeight ?? true}
          disabled={props.disabled}
          onInput={(e) => props.onInput?.(e.detail.value)}
        />
      )
    case 'switch':
      return (
        <Switch
          className={styles.mFormField__switch}
          checked={!!props.checked}
          disabled={props.disabled}
          onChange={(e) => props.onChange?.(e.detail.value)}
        />
      )
    case 'picker':
      return (
        <View className={styles.mFormField__picker} onClick={props.onClick}>
          {props.value !== undefined && props.value !== null && props.value !== '' ? (
            <AppText size={15} className={styles.mFormField__pickerValue}>
              {props.value}
            </AppText>
          ) : (
            <Text className={styles.mFormField__placeholder}>
              {props.placeholder ?? '请选择'}
            </Text>
          )}
          <Text className={styles.mFormField__pickerArrow}>›</Text>
        </View>
      )
    default:
      return null
  }
}

export default FormField
