import { useState, useEffect } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { AppText } from '@/components/atoms'
import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { ApiError } from '@/api'
import { dictApi } from '@/api'
import type { DictItem } from '@/api/types'

import styles from './index.module.scss'

const GENDER_OPTIONS: DictItem[] = [
  { id: 0, typeId: 0, type: 'gender', label: '未知', value: '0', sortOrder: 0, isDefault: false },
  { id: 1, typeId: 0, type: 'gender', label: '男', value: '1', sortOrder: 1, isDefault: false },
  { id: 2, typeId: 0, type: 'gender', label: '女', value: '2', sortOrder: 2, isDefault: false },
]

export default function ProfileEdit() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const refreshMe = useAuthStore((s) => s.refreshMe)

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [realName, setRealName] = useState(user?.realName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [gender, setGender] = useState<string>(user?.gender || '0')
  const [genderOptions, setGenderOptions] = useState<DictItem[]>(GENDER_OPTIONS)
  const [submitting, setSubmitting] = useState(false)

  useRequireAuth()

  useEffect(() => {
    // 尝试从后端拉字典（如果存在 gender 类型）
    dictApi
      .getDictByType('gender')
      .then((data) => {
        if (data && data.length > 0) setGenderOptions(data)
      })
      .catch(() => {
        // 忽略，使用本地默认
      })
  }, [])

  const handleSave = async () => {
    if (email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      Taro.showToast({ title: '邮箱格式不正确', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await userApi.updateMe({
        nickname: nickname || undefined,
        realName: realName || undefined,
        email: email || undefined,
        gender: gender as '0' | '1' | '2',
      })
      // 同步到 store
      setUser({
        nickname: nickname || undefined,
        realName: realName || undefined,
        email: email || undefined,
        gender: gender as '0' | '1' | '2',
      })
      // 强制刷新 me 拉一次
      await refreshMe()
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      Taro.showToast({ title: msg || '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const genderRange = genderOptions.map((g) => g.label)
  const genderValue = (() => {
    const idx = genderOptions.findIndex((g) => g.value === gender)
    return idx >= 0 ? idx : 0
  })()

  return (
    <View className={`page-container ${styles.edit}`}>
      <View className={styles.edit__form}>
        <View className={styles.edit__field}>
          <Text className={styles.edit__label}>昵称</Text>
          <Input
            className={styles.edit__input}
            placeholder="请输入昵称"
            placeholderClass={styles.edit__placeholder}
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
            maxlength={50}
          />
        </View>

        <View className={styles.edit__field}>
          <Text className={styles.edit__label}>真实姓名</Text>
          <Input
            className={styles.edit__input}
            placeholder="请输入真实姓名"
            placeholderClass={styles.edit__placeholder}
            value={realName}
            onInput={(e) => setRealName(e.detail.value)}
            maxlength={50}
          />
        </View>

        <View className={styles.edit__field}>
          <Text className={styles.edit__label}>邮箱</Text>
          <Input
            className={styles.edit__input}
            placeholder="请输入邮箱"
            placeholderClass={styles.edit__placeholder}
            value={email}
            onInput={(e) => setEmail(e.detail.value)}
            maxlength={100}
          />
        </View>

        <View className={styles.edit__field}>
          <Text className={styles.edit__label}>性别</Text>
          <Picker
            mode="selector"
            range={genderRange}
            value={genderValue}
            onChange={(e) => {
              const idx = e.detail.value as number
              setGender(genderOptions[idx]?.value || '0')
            }}
          >
            <View className={styles.edit__picker}>
              <AppText>
                {genderOptions.find((g) => g.value === gender)?.label || '未知'}
              </AppText>
              <Text className={styles.edit__pickerArrow}>›</Text>
            </View>
          </Picker>
        </View>
      </View>

      <View
        className={`${styles.edit__submit} ${
          submitting ? styles['edit__submit--disabled'] : ''
        }`}
        onClick={handleSave}
      >
        <Text className={styles.edit__submitText}>
          {submitting ? '保存中…' : '保 存'}
        </Text>
      </View>
    </View>
  )
}
