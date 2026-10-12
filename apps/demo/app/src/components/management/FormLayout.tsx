import { Input, Picker, Switch, Text, Textarea, View } from '@tarojs/components'
import { type ReactNode, useState } from 'react'
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
  /** 必填：label 前加红色星号，并在行尾给出说明 */
  required?: boolean
  /** 禁用：整行弱化，控件不可编辑 */
  disabled?: boolean
  error?: string
  /** 行尾补充说明，如「创建后不可修改」 */
  note?: string
  /** 独占一行：label 在上、控件占满宽度。多行文本必须用这个 */
  stacked?: boolean
  /** 行尾箭头：表示该行可跳转到下一级。与 DetailRow / LinkRow 同一位置 */
  arrow?: boolean
  /** 箭头点击（整行是否可点由控件自己决定） */
  onArrowClick?: () => void
  children: ReactNode
}

/** 表单字段：默认左侧标签 + 右侧控件；stacked 时 label 在上、控件占满整行。 */
export function FormField({
  label,
  required = false,
  disabled = false,
  error,
  note,
  stacked = false,
  arrow = false,
  onArrowClick,
  children,
}: FormFieldProps) {
  return (
    <View
      className={cx(
        styles.field,
        stacked && styles['field--stacked'],
        disabled && styles['field--disabled'],
      )}
    >
      <Text className={cx(styles.field__label, required && styles.field__required)}>{label}</Text>
      {children}
      {/* 箭头是行级元素，与整行垂直居中；放进控件内部会跟着控件的盒子走偏 */}
      {arrow ? (
        <View className={styles.field__arrow} onClick={onArrowClick}>
          <LineIcon name="chevronRight" size={16} color="#C9CDD4" />
        </View>
      ) : null}
      {error ? (
        <Text className={styles.field__error}>{error}</Text>
      ) : note ? (
        <Text className={styles.field__note}>{note}</Text>
      ) : null}
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
      className={cx(styles.field__input, disabled && styles['field__input--disabled'])}
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

export interface EnumOption<T extends string> {
  value: T
  label: string
}

export interface SwitchFieldProps {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

/**
 * 布尔开关行：标签左、开关右，与 EnumField / TextField 同一套行结构。
 *
 * Switch 自身没有宽度，直接放进 FormField 会紧跟在 76px 标签后面停在行中间；
 * 而同一张表单里的其它控件都靠 flex:1 推到行尾。两种对齐混在一张表单里会被读成两套表单。
 */
export function SwitchField({ label, checked, onChange, disabled = false }: SwitchFieldProps) {
  return (
    <FormField label={label} disabled={disabled}>
      <View className={styles.switchField}>
        <Switch
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.detail.value)}
        />
      </View>
    </FormField>
  )
}

export interface EnumFieldProps<T extends string> {
  label: string
  value: T
  options: readonly EnumOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  /** 未选中时的占位文案，默认「请选择」 */
  placeholder?: string
}

/**
 * 单选枚举（状态、类型…）的表单行：标签左、当前值右、行尾 ›，点击唤起原生选择器。
 *
 * 不用分段控件：三个以上的选项在 76px 标签列里会被挤成竖排，而分段控件一旦
 * 当前值不在选项内就只能显示高亮位置、看不出真实状态。详见
 * docs/design/mobile-form-spec.md。
 *
 * 数组下标是后端编码，数组元素是展示文案 —— 提交 value、渲染 label。
 */
export function EnumField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = '请选择',
}: EnumFieldProps<T>) {
  const index = options.findIndex((option) => option.value === value)
  const current = index >= 0 ? options[index].label : placeholder
  return (
    <FormField label={label} disabled={disabled} arrow>
      {/* H5 下 Picker 渲染成独立 div，自身没有 flex: 1 就不会撑满行，值到不了行尾 */}
      <Picker className={styles.enumPicker} disabled={disabled} mode="selector" range={options.map((option) => option.label)} value={Math.max(index, 0)} onChange={(event) => {
        const option = options[Number(event.detail.value)]
        if (option) onChange(option.value)
      }}>
        <View className={styles.enumPickerValue}>
          <Text className={index >= 0 ? undefined : styles.enumPickerPlaceholder}>{current}</Text>
        </View>
      </Picker>
    </FormField>
  )
}

export interface LinkRowProps {
  label: string
  value?: string
  onClick: () => void
  showArrow?: boolean
}/** 指向子页面的行，如「权限配置 ›」。 */
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

export interface SecretFieldProps extends TextFieldProps {
  label: string
  required?: boolean
}

/**
 * 密钥 / 凭证输入行：默认掩码，行尾眼睛图标切换明文。
 * 切换按钮是行级元素，放在控件后面，与 FormField 的 › 同一位置。
 */
export function SecretField({
  label,
  required = false,
  value,
  onChange,
  placeholder,
  maxlength = 200,
  disabled = false,
}: SecretFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <FormField label={label} required={required} disabled={disabled}>
      <Input
        className={cx(styles.field__input, disabled && styles['field__input--disabled'])}
        value={value}
        password={!visible}
        placeholder={placeholder}
        maxlength={maxlength}
        disabled={disabled}
        onInput={(event) => onChange(event.detail.value)}
      />
      <View
        className={styles.field__toggle}
        aria-label={visible ? `隐藏${label}` : `显示${label}`}
        onClick={() => setVisible(!visible)}
      >
        <LineIcon name={visible ? 'eyeOff' : 'eye'} size={18} color="#86909C" />
      </View>
    </FormField>
  )
}

export interface FormErrorProps {
  children?: ReactNode
}

/** 表单级错误（保存失败、提交前校验），位于最后一个分组之后、底部保存栏之上。 */
export function FormError({ children }: FormErrorProps) {
  return children ? <Text className={styles.error}>{children}</Text> : null
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
