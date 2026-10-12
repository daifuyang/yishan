import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'

import logo from '@/assets/brand/logo.png'
import { APP_NAME } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { resumeAfterLogin } from '@/utils/router'

import { LoginField } from './LoginField'
import { LoginIcon } from './LoginIcon'
import {
  canSubmit,
  clearRememberedAccount,
  describeLoginError,
  PASSWORD_MAX_LENGTH,
  readRememberedAccount,
  saveRememberedAccount,
  USERNAME_MAX_LENGTH,
  validateLoginForm,
} from './login-form'
import styles from './index.module.scss'

/** 自定义导航栏下内容的起始位置：避开状态栏与右上角胶囊 */
function getContentTop(): number {
  if (process.env.TARO_ENV !== 'weapp') return 48
  try {
    const capsule = Taro.getMenuButtonBoundingClientRect()
    return capsule.bottom + 24
  } catch {
    return 88
  }
}

export default function LoginPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const bootstrapped = useAuthStore((state) => state.bootstrapped)
  const contentTop = useMemo(getContentTop, [])

  const [username, setUsername] = useState(readRememberedAccount)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => readRememberedAccount() !== '')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [passwordFocus, setPasswordFocus] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitLocked = useRef(false)

  // 已有有效会话：沿用原有恢复逻辑直接进入首页
  useEffect(() => {
    if (bootstrapped && user && !submitLocked.current) void resumeAfterLogin()
  }, [bootstrapped, user?.id])

  const ready = canSubmit(username, password)

  const handleSubmit = async () => {
    if (submitLocked.current) return
    const invalid = validateLoginForm(username, password)
    if (invalid) {
      setError(invalid)
      return
    }
    submitLocked.current = true
    setSubmitting(true)
    setError(null)
    try {
      await useAuthStore.getState().login({ username: username.trim(), password, rememberMe: true })
      // 账号记忆只在登录成功后写入，且只保存账号
      if (remember) saveRememberedAccount(username)
      await resumeAfterLogin()
    } catch (failure) {
      const message = describeLoginError(failure)
      if (message) setError(message)
    } finally {
      submitLocked.current = false
      setSubmitting(false)
    }
  }

  const toggleRemember = () => {
    if (submitting) return
    const next = !remember
    setRemember(next)
    if (!next) clearRememberedAccount()
  }

  // 会话恢复中或已登录待跳转：不渲染表单，避免登录页闪现
  if (!submitting && token && (!bootstrapped || user)) {
    return <View className={styles.login} />
  }

  return (
    <View className={styles.login}>
      <View className={styles.login__body} style={{ paddingTop: `${contentTop}px` }}>
        <View className={styles.brand}>
          <Image className={styles.brand__logo} src={logo} mode="aspectFit" />
          <Text className={styles.brand__name}>{APP_NAME}</Text>
        </View>

        <View className={styles.heading}>
          <Text className={styles.heading__title}>账号登录</Text>
          <Text className={styles.heading__subtitle}>使用企业账号登录</Text>
        </View>

        <View className={styles.form}>
          <LoginField
            label="账号"
            value={username}
            placeholder="请输入用户名或邮箱"
            maxlength={USERNAME_MAX_LENGTH}
            disabled={submitting}
            confirmType="next"
            onChange={(value) => {
              setUsername(value)
              if (error) setError(null)
            }}
            onConfirm={() => setPasswordFocus(true)}
            trailing={
              username && !submitting ? (
                <View
                  className={styles.field__action}
                  hoverClass={styles['field__action--pressed']}
                  onClick={() => setUsername('')}
                >
                  <LoginIcon name="x" size={18} color="#C9CDD4" />
                </View>
              ) : null
            }
          />
          <LoginField
            label="密码"
            value={password}
            placeholder="请输入密码"
            maxlength={PASSWORD_MAX_LENGTH}
            password={!passwordVisible}
            disabled={submitting}
            focus={passwordFocus}
            confirmType="done"
            onChange={(value) => {
              setPassword(value)
              if (error) setError(null)
            }}
            onBlur={() => setPasswordFocus(false)}
            onConfirm={() => {
              if (ready) void handleSubmit()
            }}
            trailing={
              <View
                className={styles.field__action}
                hoverClass={styles['field__action--pressed']}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                <LoginIcon name={passwordVisible ? 'eye' : 'eyeOff'} size={18} />
              </View>
            }
          />

          {error ? <Text className={styles.form__error}>{error}</Text> : null}

          <View className={styles.options}>
            <View className={styles.remember} onClick={toggleRemember}>
              <View
                className={`${styles.remember__box} ${remember ? styles['remember__box--checked'] : ''}`}
              >
                {remember ? <LoginIcon name="check" size={12} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
              <Text className={styles.remember__text}>记住账号</Text>
            </View>
          </View>

          <View
            className={`${styles.submit} ${submitting ? styles['submit--loading'] : !ready ? styles['submit--disabled'] : ''}`}
            hoverClass={ready && !submitting ? styles['submit--pressed'] : 'none'}
            onClick={() => {
              if (ready && !submitting) void handleSubmit()
            }}
          >
            {submitting ? <View className={styles.submit__spinner} /> : null}
            <Text className={styles.submit__text}>{submitting ? '登录中' : '登录'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
