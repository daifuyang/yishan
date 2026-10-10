import { Input, Text, View } from '@tarojs/components'
import { useState } from 'react'

import styles from './index.module.scss'

export interface LoginFieldProps {
  label: string
  value: string
  placeholder: string
  maxlength: number
  password?: boolean
  disabled?: boolean
  focus?: boolean
  confirmType: 'next' | 'done'
  onChange: (value: string) => void
  onConfirm?: () => void
  onBlur?: () => void
  /** 输入框右侧的操作区（清除 / 显隐切换） */
  trailing?: React.ReactNode
}

/** 标签在上、输入框在下的登录表单项；聚焦时品牌蓝描边 */
export function LoginField({
  label,
  value,
  placeholder,
  maxlength,
  password = false,
  disabled = false,
  focus = false,
  confirmType,
  onChange,
  onConfirm,
  onBlur,
  trailing,
}: LoginFieldProps) {
  const [focused, setFocused] = useState(false)
  const boxClass = [
    styles.field__box,
    focused ? styles['field__box--focused'] : '',
    disabled ? styles['field__box--disabled'] : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={styles.field}>
      <Text className={styles.field__label}>{label}</Text>
      <View className={boxClass}>
        <Input
          className={styles.field__input}
          placeholderClass={styles.field__placeholder}
          value={value}
          placeholder={placeholder}
          maxlength={maxlength}
          password={password}
          disabled={disabled}
          focus={focus}
          confirmType={confirmType}
          // 键盘弹起时让输入框下方保留一段距离，尽量把登录按钮也顶上来
          cursorSpacing={96}
          adjustPosition
          onInput={(event) => onChange(event.detail.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            onBlur?.()
          }}
          onConfirm={onConfirm}
        />
        {trailing ? <View className={styles.field__trailing}>{trailing}</View> : null}
      </View>
    </View>
  )
}

export default LoginField
