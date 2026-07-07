import { useState } from 'react'
import { View, Text, Input, } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'

import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/api'
import { TAB_PAGES } from '@/constants/routes'
import LoginBrand from '@/components/organisms/LoginBrand'

import styles from './index.module.scss'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useLoad(() => {
    const { token, bootstrapped } = useAuthStore.getState()
    if (token && bootstrapped) {
      Taro.switchTab({ url: `/${TAB_PAGES.home}` })
    }
  })

  const handleSubmit = async () => {
    if (!username.trim()) {
      Taro.showToast({ title: '请输入账号', icon: 'none' })
      return
    }
    if (!password) {
      Taro.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await useAuthStore.getState().login({
        username: username.trim(),
        password,
        rememberMe: true,
      })
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: `/${TAB_PAGES.home}` })
      }, 400)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : (err as Error)?.message || '登录失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={`page-container ${styles.login}`}>
      <LoginBrand />

      <View className={styles.login__form}>
        <View className={styles.login__field}>
          <Text className={styles.login__label}>账号</Text>
          <Input
            className={styles.login__input}
            placeholder="请输入用户名 / 邮箱"
            placeholderClass={styles.login__placeholder}
            value={username}
            onInput={(e) => setUsername(e.detail.value)}
            maxlength={100}
          />
        </View>

        <View className={styles.login__field}>
          <Text className={styles.login__label}>密码</Text>
          <Input
            className={styles.login__input}
            placeholder="请输入密码"
            placeholderClass={styles.login__placeholder}
            password
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
            maxlength={50}
          />
        </View>

        <View
          className={`${styles.login__submit} ${
            submitting ? styles['login__submit--disabled'] : ''
          }`}
          onClick={handleSubmit}
        >
          <Text className={styles.login__submitText}>
            {submitting ? '登录中…' : '登 录'}
          </Text>
        </View>

        <View className={styles.login__hint}>
          <Text>默认账号：admin / admin123</Text>
        </View>
      </View>
    </View>
  )
}
