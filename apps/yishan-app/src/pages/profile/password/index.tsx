import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { ApiError } from '@/api'
import { LOGIN_PATH } from '@/constants/routes'

import styles from './index.module.scss'

export default function ProfilePassword() {
  const logout = useAuthStore((s) => s.logout)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useRequireAuth()

  const handleSubmit = async () => {
    if (!oldPwd) {
      Taro.showToast({ title: '请输入旧密码', icon: 'none' })
      return
    }
    if (newPwd.length < 6) {
      Taro.showToast({ title: '新密码至少 6 位', icon: 'none' })
      return
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/.test(newPwd)) {
      Taro.showToast({ title: '密码需含字母和数字', icon: 'none' })
      return
    }
    if (newPwd !== confirmPwd) {
      Taro.showToast({ title: '两次新密码不一致', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await userApi.changeMyPassword({ oldPassword: oldPwd, newPassword: newPwd })
      Taro.showModal({
        title: '密码已修改',
        content: '请使用新密码重新登录',
        showCancel: false,
        success: async () => {
          await logout()
          Taro.reLaunch({ url: `/pages/${LOGIN_PATH}` })
        },
      })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      Taro.showToast({ title: msg || '修改失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={`page-container ${styles.pwd}`}>
      <View className={styles.pwd__form}>
        <View className={styles.pwd__field}>
          <Text className={styles.pwd__label}>旧密码</Text>
          <Input
            className={styles.pwd__input}
            placeholder="请输入旧密码"
            placeholderClass={styles.pwd__placeholder}
            password
            value={oldPwd}
            onInput={(e) => setOldPwd(e.detail.value)}
            maxlength={50}
          />
        </View>

        <View className={styles.pwd__field}>
          <Text className={styles.pwd__label}>新密码</Text>
          <Input
            className={styles.pwd__input}
            placeholder="字母+数字，6-50 位"
            placeholderClass={styles.pwd__placeholder}
            password
            value={newPwd}
            onInput={(e) => setNewPwd(e.detail.value)}
            maxlength={50}
          />
        </View>

        <View className={styles.pwd__field}>
          <Text className={styles.pwd__label}>确认新密码</Text>
          <Input
            className={styles.pwd__input}
            placeholder="再次输入新密码"
            placeholderClass={styles.pwd__placeholder}
            password
            value={confirmPwd}
            onInput={(e) => setConfirmPwd(e.detail.value)}
            maxlength={50}
          />
        </View>
      </View>

      <View
        className={`${styles.pwd__submit} ${
          submitting ? styles['pwd__submit--disabled'] : ''
        }`}
        onClick={handleSubmit}
      >
        <Text className={styles.pwd__submitText}>
          {submitting ? '提交中…' : '确 认'}
        </Text>
      </View>
    </View>
  )
}
