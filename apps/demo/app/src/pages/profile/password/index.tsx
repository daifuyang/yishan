import { useEffect, useRef, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { ApiError } from '@/api'
import {
  ManagementPage,
  ManagementPageHeader,
  FormContent,
  FormSection,
  FormField,
  FormSubmitBar,
} from '@/components/management'
import { getSessionVersion } from '@/api/client'
import { LineIcon } from '@/components/icons'
import { redirectToLogin } from '@/utils/router'

import styles from './index.module.scss'

const PASSWORD_MIN = 6
const PASSWORD_MAX = 50
const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$/
const SUCCESS_TOAST_MS = 1500

interface PasswordRowProps {
  label: string
  placeholder: string
  value: string
  onInput: (value: string) => void
  disabled?: boolean
}

function PasswordRow({ label, placeholder, value, onInput, disabled }: PasswordRowProps) {
  const [visible, setVisible] = useState(false)
  return (
    <FormField label={label} required disabled={disabled}>
      <View className={styles.pwd__control}>
        <Input
          className={styles.pwd__input}
          placeholder={placeholder}
          placeholderClass={styles.pwd__placeholder}
          password={!visible}
          disabled={disabled}
          value={value}
          onInput={(e) => onInput(e.detail.value)}
          maxlength={PASSWORD_MAX}
        />
        <View
          className={styles.pwd__eye}
          hoverClass={styles['pwd__eye--pressed']}
          aria-label={visible ? '隐藏密码' : '显示密码'}
          onClick={disabled ? undefined : () => setVisible((v) => !v)}
        >
          <LineIcon name={visible ? 'eye' : 'eyeOff'} size={20} />
        </View>
      </View>
    </FormField>
  )
}

function validate(oldPwd: string, newPwd: string, confirmPwd: string): string | null {
  if (
    newPwd.length < PASSWORD_MIN ||
    newPwd.length > PASSWORD_MAX ||
    !PASSWORD_PATTERN.test(newPwd)
  ) {
    return '新密码需为 6-50 位，且同时包含字母和数字'
  }
  if (newPwd === oldPwd) return '新密码不能与当前密码相同'
  if (newPwd !== confirmPwd) return '两次输入的新密码不一致'
  return null
}

export default function ProfilePassword() {
  const logout = useAuthStore((s) => s.logout)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submitLocked = useRef(false)
  const alive = useRef(true)
  const session = useRef(getSessionVersion()).current
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const isCurrent = () =>
    alive.current && session === getSessionVersion() && Boolean(useAuthStore.getState().token)

  const auth = useRequireAuth()
  const ready = Boolean(oldPwd && newPwd && confirmPwd)

  const handleSubmit = async () => {
    if (!auth.ready || !auth.allowed || !isCurrent() || submitLocked.current) return
    if (!ready) {
      Taro.showToast({ title: '请填写完整密码信息', icon: 'none' })
      return
    }
    const invalid = validate(oldPwd, newPwd, confirmPwd)
    if (invalid) {
      Taro.showToast({ title: invalid, icon: 'none' })
      return
    }
    submitLocked.current = true
    setSubmitting(true)
    try {
      await userApi.changeMyPassword({ oldPassword: oldPwd, newPassword: newPwd })
      if (!isCurrent()) return
      // 服务端已撤销全部登录态：提示后清理本地会话并回到登录页
      Taro.showToast({
        title: '密码已修改，请重新登录',
        icon: 'success',
        duration: SUCCESS_TOAST_MS,
      })
      await new Promise((resolve) => setTimeout(resolve, SUCCESS_TOAST_MS))
      if (!isCurrent()) return
      const loggingOut = logout()
      const clearedSession = getSessionVersion()
      await loggingOut
      if (alive.current && clearedSession === getSessionVersion() && !useAuthStore.getState().token)
        await redirectToLogin(false)
    } catch (e) {
      if (!isCurrent()) return
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      Taro.showToast({ title: msg || '修改失败，请稍后重试', icon: 'none' })
    } finally {
      submitLocked.current = false
      if (alive.current) setSubmitting(false)
    }
  }

  const disabled = submitting || !auth.ready || !auth.allowed
  return (
    <ManagementPage>
      {Taro.getEnv() === Taro.ENV_TYPE.WEB && <ManagementPageHeader title="修改密码" />}
      <FormContent>
        <FormSection
          title="密码信息"
          hint="长度 6-50 位，须同时包含字母和数字，可使用特殊字符 @$!%*?&"
        >
          <PasswordRow
            label="当前密码"
            placeholder="请输入当前密码"
            value={oldPwd}
            onInput={setOldPwd}
            disabled={disabled}
          />
          <PasswordRow
            label="新密码"
            placeholder="请输入新密码"
            value={newPwd}
            onInput={setNewPwd}
            disabled={disabled}
          />
          <PasswordRow
            label="确认密码"
            placeholder="请再次输入新密码"
            value={confirmPwd}
            onInput={setConfirmPwd}
            disabled={disabled}
          />
        </FormSection>
        <Text className={styles.pwd__tip}>
          修改成功后，所有登录会话将失效，请使用新密码重新登录。
        </Text>
      </FormContent>
      <FormSubmitBar text="确认修改" submitting={disabled || !ready} onSubmit={handleSubmit} />
    </ManagementPage>
  )
}
