import { useEffect, useRef, useState } from 'react'
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
  FormError,
  FormSubmitBar,
  SecretField,
} from '@/components/management'
import { getSessionVersion } from '@/api/client'
import { redirectToLogin } from '@/utils/router'

const PASSWORD_MIN = 6
const PASSWORD_MAX = 50
const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$/
const SUCCESS_TOAST_MS = 1500

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
  const [error, setError] = useState<string | null>(null)
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

  // 改动任一字段就把上一次的失败信息收起来：留着旧错误，用户会以为新值仍然不合法
  const editField = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    if (error) setError(null)
  }

  const handleSubmit = async () => {
    // 三项未填完时按钮已置灰不可点，这里只做兜底，不再另行提示
    if (!auth.ready || !auth.allowed || !isCurrent() || submitLocked.current || !ready) return
    const invalid = validate(oldPwd, newPwd, confirmPwd)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
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
      // 失败保留页面与已填内容，错误就地呈现，不再弹 toast 打断
      if (alive.current) setError(msg || '修改失败，请稍后重试')
    } finally {
      submitLocked.current = false
      if (alive.current) setSubmitting(false)
    }
  }

  const disabled = submitting || !auth.ready || !auth.allowed
  return (
    <ManagementPage>
      <ManagementPageHeader title="修改密码" showBack={process.env.TARO_ENV === 'h5'} />
      <FormContent>
        <FormSection
          title="密码信息"
          hint="6-50 位，须同时包含字母和数字，可含特殊字符 @$!%*?&；修改后需重新登录"
        >
          <SecretField
            label="当前密码"
            required
            value={oldPwd}
            onChange={editField(setOldPwd)}
            placeholder="请输入当前密码"
            maxlength={PASSWORD_MAX}
            disabled={disabled}
          />
          <SecretField
            label="新密码"
            required
            value={newPwd}
            onChange={editField(setNewPwd)}
            placeholder="请输入新密码"
            maxlength={PASSWORD_MAX}
            disabled={disabled}
          />
          <SecretField
            label="确认密码"
            required
            value={confirmPwd}
            onChange={editField(setConfirmPwd)}
            placeholder="请再次输入新密码"
            maxlength={PASSWORD_MAX}
            disabled={disabled}
          />
        </FormSection>
        {/* 校验与提交失败都落在表单边界，由共享 FormError 统一呈现 */}
        <FormError>{error}</FormError>
      </FormContent>
      <FormSubmitBar text="确认修改" submitting={submitting} disabled={disabled || !ready} onSubmit={handleSubmit} />
    </ManagementPage>
  )
}
