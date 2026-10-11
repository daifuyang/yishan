import { useState, useEffect, useRef } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { Button } from '@/components/atoms'
import { LineIcon } from '@/components/icons'
import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { ApiError } from '@/api'
import { dictApi } from '@/api'
import type { DictItem } from '@/api/types'
import { PageContainer } from '@/components/layout'
import { navigateBack } from '@/utils/router'

import styles from './index.module.scss'

const GENDER_DICT_TYPE = 'user_gender'

const GENDER_OPTIONS: DictItem[] = [
  { id: 0, typeId: 0, type: 'user_gender', label: '保密', value: '0', sortOrder: 0, isDefault: false },
  { id: 1, typeId: 0, type: 'user_gender', label: '男', value: '1', sortOrder: 1, isDefault: false },
  { id: 2, typeId: 0, type: 'user_gender', label: '女', value: '2', sortOrder: 2, isDefault: false },
]

const PHONE_PATTERN = /^1[3-9]\d{9}$/

function today() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toDateValue(value?: string) {
  return value ? value.slice(0, 10) : ''
}

export default function ProfileEdit() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const refreshMe = useAuthStore((s) => s.refreshMe)

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [realName, setRealName] = useState(user?.realName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [birthDate, setBirthDate] = useState(toDateValue(user?.birthDate))
  const [gender, setGender] = useState<string>(user?.gender || '0')
  const [genderOptions, setGenderOptions] = useState<DictItem[]>(GENDER_OPTIONS)
  const [submitting, setSubmitting] = useState(false)
  const initializedUserId = useRef<number | null>(null)
  const submitLocked = useRef(false)

  const auth = useRequireAuth()

  useEffect(() => {
    if (!auth.ready || !auth.allowed || !user || initializedUserId.current === user.id) return
    initializedUserId.current = user.id
    setNickname(user.nickname || '')
    setRealName(user.realName || '')
    setEmail(user.email || '')
    setPhone(user.phone || '')
    setBirthDate(toDateValue(user.birthDate))
    setGender(user.gender || '0')
  }, [auth.ready, auth.allowed, user])

  useEffect(() => {
    if (!auth.ready || !auth.allowed) return
    let active = true
    dictApi
      .getDictByType(GENDER_DICT_TYPE)
      .then((data) => {
        const items = (data ?? []).filter((item) => item.type === GENDER_DICT_TYPE)
        if (active && items.length > 0) setGenderOptions(items)
      })
      .catch(() => {
        // 忽略，使用本地默认
      })
    return () => {
      active = false
    }
  }, [auth.ready, auth.allowed])

  const handleSave = async () => {
    if (!auth.ready || !auth.allowed || submitLocked.current) return
    if (email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      Taro.showToast({ title: '邮箱格式不正确', icon: 'none' })
      return
    }
    if (phone && !PHONE_PATTERN.test(phone)) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    submitLocked.current = true
    setSubmitting(true)
    try {
      await userApi.updateMe({
        nickname: nickname || undefined,
        realName: realName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        gender: gender as '0' | '1' | '2',
        birthDate: birthDate || undefined,
      })
      // 同步到 store
      setUser({
        nickname: nickname || undefined,
        realName: realName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        gender: gender as '0' | '1' | '2',
        birthDate: birthDate || undefined,
      })
      // 强制刷新 me 拉一次
      await refreshMe()
      Taro.showToast({ title: '保存成功', icon: 'success' })
      navigateBack()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      Taro.showToast({ title: msg || '保存失败', icon: 'none' })
    } finally {
      submitLocked.current = false
      setSubmitting(false)
    }
  }

  const genderRange = genderOptions.map((g) => g.label)
  const genderValue = (() => {
    const idx = genderOptions.findIndex((g) => g.value === gender)
    return idx >= 0 ? idx : 0
  })()

  return (
    <PageContainer className={styles.edit}>
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
          <Text className={styles.edit__label}>手机号</Text>
          <Input
            className={styles.edit__input}
            type="number"
            placeholder="请输入 11 位手机号"
            placeholderClass={styles.edit__placeholder}
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
            maxlength={11}
          />
        </View>

        <Picker
          className={styles.edit__row}
          mode="selector"
          range={genderRange}
          value={genderValue}
          onChange={(e) => {
            const idx = Number(e.detail.value)
            setGender(genderOptions[idx]?.value || '0')
          }}
        >
          <View className={`${styles.edit__field} ${styles.edit__fieldBare}`} hoverClass={styles.edit__fieldHover} hoverStayTime={60}>
            <Text className={styles.edit__label}>性别</Text>
            <Text className={styles.edit__value}>
              {genderOptions.find((g) => g.value === gender)?.label || '保密'}
            </Text>
            <LineIcon name="chevronRight" size={16} className={styles.edit__arrow} />
          </View>
        </Picker>

        <Picker
          className={styles.edit__row}
          mode="date"
          value={birthDate}
          end={today()}
          onChange={(e) => setBirthDate(String(e.detail.value))}
        >
          <View className={`${styles.edit__field} ${styles.edit__fieldBare}`} hoverClass={styles.edit__fieldHover} hoverStayTime={60}>
            <Text className={styles.edit__label}>出生日期</Text>
            <Text className={`${styles.edit__value} ${birthDate ? '' : styles.edit__valueEmpty}`}>
              {birthDate || '请选择出生日期'}
            </Text>
            <LineIcon name="chevronRight" size={16} className={styles.edit__arrow} />
          </View>
        </Picker>
      </View>

      <Button variant="primary" size="lg" block loading={submitting} onClick={handleSave}>
        保存
      </Button>
    </PageContainer>
  )
}
