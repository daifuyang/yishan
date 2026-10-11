import { Input, Text, Textarea, View } from '@tarojs/components'
import type { ReactNode } from 'react'
import styles from './FormLayout.module.scss'
import { LineIcon } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface FormContentProps {
  children: ReactNode
  className?: string
}

/** 表单正文容器，底部预留固定保存栏。 */
export function FormContent({ children, className = '' }: FormContentProps) {
  return <View className={cx(styles.content, className)}>{children}</View>
}

export interface FormSectionProps {
  title?: string
  hint?: string
  children: ReactNode
}

export function FormSection({ title, hint, children }: FormSectionProps) {
  return (
    <View className={styles.sectionBlock}>
      {title ? <Text className={styles.section__title}>{title}</Text> : null}
      <View className={styles.section}>
        {children}
        {hint ? <Text className={styles.section__hint}>{hint}</Text> : null}
      </View>
    </View>
  )
}

export interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}

/** 表单字段：标签 + 控件 + 错误提示。 */
export function FormField({ label, required = false, error, children }: FormFieldProps) {
  return (
    <View className={styles.field}>
      <Text className={cx(styles.field__label, required && styles.field__required)}>{label}</Text>
      {children}
      {error ? <Text className={styles.field__error}>{error}</Text> : null}
    </View>
  )
}

export interface TextFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxlength?: number
  disabled?: boolean
}

export function TextField({
  value,
  onChange,
  placeholder,
  maxlength = 50,
  disabled,
}: TextFieldProps) {
  return (
    <Input
      className={styles.field__input}
      value={value}
      placeholder={placeholder}
      maxlength={maxlength}
      disabled={disabled}
      onInput={(event) => onChange(event.detail.value)}
    />
  )
}

export interface TextAreaFieldProps extends TextFieldProps {
  maxlength?: number
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  maxlength = 200,
  disabled,
}: TextAreaFieldProps) {
  return (
    <Textarea
      className={styles.field__textarea}
      value={value}
      placeholder={placeholder}
      maxlength={maxlength}
      disabled={disabled}
      onInput={(event) => onChange(event.detail.value)}
    />
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export interface SegmentFieldProps<T extends string> {
  value: T
  options: readonly SegmentOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}

/** 分段选择器，移动端替代 PC 的 Select。 */
export function SegmentField<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: SegmentFieldProps<T>) {
  return (
    <View className={styles.segment}>
      {options.map((option) => (
        <View
          key={option.value}
          className={cx(styles.segment__item, option.value === value && styles.segment__itemActive)}
          onClick={disabled ? undefined : () => onChange(option.value)}
          aria-label={option.label}
        >
          <Text>{option.label}</Text>
        </View>
      ))}
    </View>
  )
}

export interface LinkRowProps {
  label: string
  value?: string
  onClick: () => void
  showArrow?: boolean
}

/** 指向子页面的行，如「权限配置 ›」。 */
export function LinkRow({ label, value, onClick, showArrow = true }: LinkRowProps) {
  return (
    <View
      className={styles.link}
      onClick={onClick}
      hoverClass={cx(styles.segment__itemActive)}
      aria-label={label}
    >
      <Text className={styles.link__label}>{label}</Text>
      <View className={styles.link__value}>
        {value ? <Text>{value}</Text> : null}
        {showArrow ? <LineIcon name="chevronRight" size={16} color="#C9CDD4" /> : null}
      </View>
    </View>
  )
}

export interface FormSubmitBarProps {
  text: string
  submitting?: boolean
  onSubmit: () => void
}

/** 底部固定保存按钮。 */
export function FormSubmitBar({ text, submitting = false, onSubmit }: FormSubmitBarProps) {
  return (
    <View className={styles.submit}>
      <View
        className={cx(styles.submit__button, submitting && styles.submit__disabled)}
        onClick={submitting ? undefined : onSubmit}
        aria-label={text}
        aria-disabled={submitting}
      >
        <Text>{submitting ? '保存中…' : text}</Text>
      </View>
    </View>
  )
}
