import { useState, useEffect, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { adminUserApi, adminDeptApi, adminRoleApi } from '@/api'
import type { FormErrors } from '../types'

export function useUserEditForm(id: string | undefined) {
  const isEdit = id !== undefined
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [realName, setRealName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState(0)
  const [status, setStatus] = useState(0)
  const [deptIds, setDeptIds] = useState<number[]>([])
  const [roleIds, setRoleIds] = useState<number[]>([])

  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [depts, setDepts] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])

  const loadUser = async (userId: string) => {
    setLoading(true)
    try {
      const res = await adminUserApi.getAdminUser({ id: userId })
      if (res.success && res.data) {
        setUsername(res.data.username || '')
        setNickname(res.data.nickname || '')
        setRealName(res.data.realName || '')
        setPhone(res.data.phone || '')
        setEmail(res.data.email || '')
        setGender(res.data.gender ?? 0)
        setStatus(res.data.status ?? 0)
        setDeptIds(res.data.deptIds || [])
        setRoleIds(res.data.roleIds || [])
      } else {
        setPageError('加载用户失败')
      }
    } catch (e: any) {
      setPageError(e?.message || '加载用户失败')
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
      if (deptRes.success) setDepts(deptRes.data || [])
      if (roleRes.success) setRoles(roleRes.data || [])
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
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload: any = {
        username, nickname, realName, phone, email,
        gender, status, deptIds, roleIds,
      }
      if (password) payload.password = password
      const fn = isEdit
        ? adminUserApi.updateAdminUser({ id: id!, ...payload })
        : adminUserApi.createAdminUser(payload)
      const res = await fn
      if (res.success) {
        Taro.showToast({ title: isEdit ? '修改成功' : '创建成功', icon: 'success' })
        const { navigateBack } = await import('@/utils/router')
        navigateBack(1)
      } else {
        Taro.showToast({ title: res.message || '操作失败', icon: 'error' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '操作失败', icon: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    loadOptions()
    if (isEdit && id) loadUser(id)
    else setLoading(false)
  }, [id, isEdit])

  const genderLabel = useMemo(() => ['保密', '男', '女'][gender] || '保密', [gender])
  const statusLabel = useMemo(() => ['启用', '禁用', '锁定'][status] || '启用', [status])

  return {
    values: { username, setUsername, nickname, setNickname, realName, setRealName,
      phone, setPhone, email, setEmail, password, setPassword,
      gender, setGender, status, setStatus, deptIds, setDeptIds, roleIds, setRoleIds },
    errors, loading, pageError, submitting, depts, roles, isEdit,
    genderLabel, statusLabel, handleSubmit,
    toggleDept: (id: number) => setDeptIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    toggleRole: (id: number) => setRoleIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
  }
}
