import { useState, useEffect, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

import {
  DateField,
  ManagementPage,
  ManagementPageHeader,
  FormContent,
  FormSection,
  FormField,
  FormError,
  EnumField,
  TextField,
  FormSubmitBar,
} from '@/components/management'
import { getSessionVersion } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { ApiError } from '@/api'
import { dictApi } from '@/api'
import type { DictItem } from '@/api/types'
import { navigateBack } from '@/utils/router'

import styles from './index.module.scss'

const GENDER_DICT_TYPE = 'user_gender'

const GENDER_OPTIONS: DictItem[] = [
  {
    id: 0,
    typeId: 0,
    type: 'user_gender',
    label: '保密',
    value: '0',
    sortOrder: 0,
    isDefault: false,
  },
  {
    id: 1,
    typeId: 0,
    type: 'user_gender',
    label: '男',
    value: '1',
    sortOrder: 1,
    isDefault: false,
  },
  {
    id: 2,
    typeId: 0,
    type: 'user_gender',
    label: '女',
    value: '2',
    sortOrder: 2,
    isDefault: false,
  },
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
  const [error, setError] = useState<string | null>(null)
  const initializedUserId = useRef<number | null>(null)
  const submitLocked = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

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

  const clearError = () => {
    if (error) setError(null)
  }

  // 改动任一字段就把上一次的失败信息收起来：留着旧错误，用户会以为新值仍然不合法
  const editField = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    clearError()
  }

  const handleSave = async () => {
    if (!auth.ready || !auth.allowed || submitLocked.current) return
    if (email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      setError('邮箱格式不正确')
      return
    }
    if (phone && !PHONE_PATTERN.test(phone)) {
      setError('手机号格式不正确')
      return
    }
    setError(null)
    const session = getSessionVersion()
    const userId = user?.id
    if (!userId || initializedUserId.current !== userId) return
    const isCurrent = () =>
      alive.current &&
      session === getSessionVersion() &&
      useAuthStore.getState().user?.id === userId
    if (!isCurrent() || !useAuthStore.getState().token) return
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
      if (!isCurrent()) return
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
      if (!isCurrent()) return
      Taro.showToast({ title: '保存成功', icon: 'success' })
      navigateBack()
    } catch (e) {
      if (!isCurrent()) return
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      // 失败保留页面与已填内容，错误就地呈现，不再弹 toast 打断
      if (alive.current) setError(msg || '保存失败')
    } finally {
      submitLocked.current = false
      if (alive.current) setSubmitting(false)
    }
  }

  const genderEnum = genderOptions.map((option) => ({ value: option.value, label: option.label }))
  const disabled = submitting || !auth.ready || !auth.allowed || !user
  return (
    <ManagementPage>
      <ManagementPageHeader title="个人资料" showBack={process.env.TARO_ENV === 'h5'} />
      <FormContent>
        <FormSection title="基本信息">
          <FormField label="昵称" disabled={disabled}>
            <TextField
              value={nickname}
              onChange={editField(setNickname)}
              placeholder="请输入昵称"
              disabled={disabled}
            />
          </FormField>
          <FormField label="真实姓名" disabled={disabled}>
            <TextField
              value={realName}
              onChange={editField(setRealName)}
              placeholder="请输入真实姓名"
              disabled={disabled}
            />
          </FormField>
          <EnumField
            label="性别"
            value={gender}
            options={genderEnum}
            onChange={editField(setGender)}
            disabled={disabled}
          />
          <FormField label="出生日期" disabled={disabled} arrow>
            <DateField
              className={styles.picker}
              disabled={disabled}
              value={birthDate}
              end={today()}
              onChange={(next) => {
                setBirthDate(next)
                clearError()
              }}
            >
              <View className={`${styles.pickerValue} ${birthDate && !disabled ? '' : styles.empty}`}>
                <Text>{birthDate || '请选择出生日期'}</Text>
              </View>
            </DateField>
          </FormField>
        </FormSection>
        <FormSection title="联系方式">
          <FormField label="邮箱" disabled={disabled}>
            <TextField
              value={email}
              onChange={editField(setEmail)}
              placeholder="请输入邮箱"
              maxlength={100}
              disabled={disabled}
            />
          </FormField>
          <FormField label="手机号" disabled={disabled}>
            <TextField
              type="number"
              value={phone}
              onChange={editField(setPhone)}
              placeholder="请输入手机号"
              maxlength={11}
              disabled={disabled}
            />
          </FormField>
        </FormSection>
        {/* 校验与提交失败都落在表单边界，由共享 FormError 统一呈现 */}
        <FormError>{error}</FormError>
      </FormContent>
      <FormSubmitBar text="保存" submitting={submitting} disabled={disabled} onSubmit={handleSave} />
    </ManagementPage>
  )
}
