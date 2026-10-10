import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { adminUserApi, adminDeptApi, adminRoleApi } from '@/api'
import type { FormErrors } from '../types'
import type { AdminDept, AdminRole, UpdateAdminUserReq } from '@/api/admin/types'

export function useUserEditForm(id: string | undefined, enabled = true) {
  const isEdit = id !== undefined
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [realName, setRealName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState<'0' | '1' | '2'>('0')
  const [status, setStatus] = useState<'0' | '1' | '2'>('1')
  const [deptIds, setDeptIds] = useState<number[]>([])
  const [roleIds, setRoleIds] = useState<number[]>([])

  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [depts, setDepts] = useState<AdminDept[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const submittingRef = useRef(false)

  const loadUser = async (userId: string) => {
    setLoading(true)
    try {
      const res = await adminUserApi.getAdminUser(Number(userId))
      setUsername(res.username || '')
      setNickname(res.nickname || '')
      setRealName(res.realName || '')
      setPhone(res.phone || '')
      setEmail(res.email || '')
      setGender(res.gender)
      setStatus(res.status)
      setDeptIds(res.deptIds || [])
      setRoleIds(res.roleIds || [])
    } catch (e) {
      setPageError(e instanceof Error ? e.message : '加载用户失败')
    } finally {
      setLoading(false)
    }
  }

  const loadOptions = async () => {
    try {
      const [deptRes, roleRes] = await Promise.all([
        adminDeptApi.listAdminDepts(),
        adminRoleApi.listAdminRoles(),
      ])
      setDepts(deptRes.data || [])
      setRoles(roleRes.data || [])
    } catch {
      // silent
    }
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!isEdit && !username) next.username = '请输入用户名'
    if (!phone) next.phone = '请输入手机号'
    if (!isEdit && !password) next.password = '请输入密码'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!enabled || submittingRef.current) return
    if (!validate()) return
    setSubmitting(true)
    submittingRef.current = true
    try {
      const payload: UpdateAdminUserReq = {
        username,
        nickname,
        realName,
        phone,
        email,
        gender,
        status,
        deptIds,
        roleIds,
      }
      if (password) payload.password = password
      const fn = isEdit
        ? adminUserApi.updateAdminUser(Number(id), payload)
        : adminUserApi.createAdminUser({ ...payload, phone, password })
      const res = await fn
      if (res) {
        Taro.showToast({ title: isEdit ? '修改成功' : '创建成功', icon: 'success' })
        const { navigateBack } = await import('@/utils/router')
        navigateBack(1)
      }
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' })
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    loadOptions()
    if (isEdit && id) loadUser(id)
    else setLoading(false)
  }, [enabled, id, isEdit])

  const genderLabel = ['未知', '男', '女'][Number(gender)]
  const statusLabel = ['禁用', '启用', '锁定'][Number(status)]

  return {
    values: {
      username,
      setUsername,
      nickname,
      setNickname,
      realName,
      setRealName,
      phone,
      setPhone,
      email,
      setEmail,
      password,
      setPassword,
      gender,
      setGender,
      status,
      setStatus,
      deptIds,
      setDeptIds,
      roleIds,
      setRoleIds,
    },
    errors,
    loading,
    pageError,
    submitting,
    depts,
    roles,
    isEdit,
    genderLabel,
    statusLabel,
    handleSubmit,
    reload: async () => {
      setPageError(undefined)
      await loadOptions()
      if (id) await loadUser(id)
    },
    toggleDept: (id: number) =>
      setDeptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    toggleRole: (id: number) =>
      setRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
  }
}
