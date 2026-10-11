import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { adminUserApi, adminDeptApi, adminRoleApi } from '@/api'
import type { FormErrors } from '../types'
import type { AdminDept, AdminRole, UpdateAdminUserReq } from '@/api/admin/types'
import { useCanWrite } from '@/hooks/useCanWrite'
import { validateUserForm } from '../model'
import { getSessionVersion } from '@/api/client'
import { canWriteModuleNow } from '@/utils/auth-guard'

export function useUserEditForm(id: string | undefined, enabled = true) {
  const isEdit = id !== undefined
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [realName, setRealName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [birthDate, setBirthDate] = useState('')
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
  const sequence = useRef(0)
  const active = useRef(enabled)
  active.current = enabled
  const canReadDepts = useCanWrite('system:department:list')
  const canReadRoles = useCanWrite('system:role:list')

  const loadUser = async (userId: string, requestSequence = sequence.current) => {
    setLoading(true)
    try {
      if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) throw new Error('用户 ID 无效')
      const res = await adminUserApi.getAdminUser(Number(userId))
      if (!active.current || requestSequence !== sequence.current) return
      setUsername(res.username || '')
      setNickname(res.nickname || '')
      setRealName(res.realName || '')
      setPhone(res.phone || '')
      setEmail(res.email || '')
      setGender(res.gender)
      setStatus(res.status)
      setBirthDate(res.birthDate?.slice(0, 10) || '')
      setDeptIds(res.deptIds || [])
      setRoleIds(res.roleIds || [])
    } catch (e) {
      if (active.current && requestSequence === sequence.current) setPageError(e instanceof Error ? e.message : '加载用户失败')
    } finally {
      if (active.current && requestSequence === sequence.current) setLoading(false)
    }
  }

  const loadOptions = async (requestSequence = sequence.current) => {
    const results = await Promise.allSettled([
      canReadDepts ? adminDeptApi.getAdminDeptTree() : Promise.resolve([]),
      (async () => {
        if (!canReadRoles) return []
        const all: AdminRole[] = []
        let page = 1
        for (;;) {
          const result = await adminRoleApi.listAdminRoles({ page, pageSize: 100 })
          all.push(...result.data)
          if (page >= result.pagination.totalPages || !result.data.length) return all
          page++
        }
      })(),
    ])
    if (!active.current || requestSequence !== sequence.current) return
    const flatten = (nodes: AdminDept[]): AdminDept[] => nodes.flatMap((node) => [node, ...flatten(node.children ?? [])])
    if (results[0].status === 'fulfilled') setDepts(flatten(results[0].value))
    if (results[1].status === 'fulfilled') setRoles(results[1].value)
    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length) setPageError('部门或角色选项加载失败，请重试')
  }

  const validate = (): boolean => {
    const next: FormErrors = validateUserForm({ username, phone, email, password, birthDate }, isEdit)
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!active.current || submittingRef.current || loading || pageError) return
    if (!validate()) return
    const version = getSessionVersion()
    const requestSequence = sequence.current
    const current = () => active.current && requestSequence === sequence.current && version === getSessionVersion()
    if (!canWriteModuleNow('system-user', [isEdit ? 'system:user:update' : 'system:user:create'])) return
    setSubmitting(true)
    submittingRef.current = true
    try {
      const payload: UpdateAdminUserReq = {
        username,
        nickname,
        realName,
        phone: phone.trim(),
        email: email.trim() || undefined,
        gender,
        status,
        birthDate,
        deptIds,
        roleIds,
      }
      if (password) payload.password = password
      const fn = isEdit
        ? adminUserApi.updateAdminUser(Number(id), payload)
        : adminUserApi.createAdminUser({ ...payload, phone: phone.trim(), password })
      const res = await fn
      if (!current()) return
      if (res) {
        Taro.showToast({ title: isEdit ? '修改成功' : '创建成功', icon: 'success' })
        const { navigateBack } = await import('@/utils/router')
        navigateBack(1)
      }
    } catch (e) {
      if (current()) Taro.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' })
    } finally {
      if (current()) setSubmitting(false)
      submittingRef.current = false
    }
  }

  useEffect(() => {
    const requestSequence = ++sequence.current
    setPageError(undefined)
    setDepts([])
    setRoles([])
    if (!enabled) {
      setLoading(false)
      return
    }
    void loadOptions(requestSequence)
    if (isEdit && id) void loadUser(id, requestSequence)
    else setLoading(false)
    return () => { sequence.current++ }
  }, [enabled, id, isEdit, canReadDepts, canReadRoles])

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
      birthDate,
      setBirthDate,
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
    canReadDepts,
    canReadRoles,
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
