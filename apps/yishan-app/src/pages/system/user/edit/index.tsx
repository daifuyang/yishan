import { useState, useEffect, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'

import { AppText, Button, Tag } from '@/components/atoms'
import { PageHeader, Card, FormField, BottomActionBar } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { adminUserApi, adminDeptApi, adminRoleApi } from '@/api'
import type {
  AdminDept,
  AdminRole,
  AdminUser,
  CreateAdminUserReq,
  UpdateAdminUserReq,
} from '@/api/admin/types'

import styles from './index.module.scss'

interface FormErrors {
  username?: string
  phone?: string
  email?: string
  password?: string
}

export default function UserEditPage() {
  useRequireAuth()
  const router = useRouter()
  const id = router.params.id ? Number(router.params.id) : null
  const isEdit = !!id

  // 表单状态
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
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [depts, setDepts] = useState<AdminDept[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])

  // 加载用户详情（编辑模式）
  const loadUser = async (uid: number) => {
    setLoading(true)
    setPageError(null)
    try {
      const u = await adminUserApi.getAdminUser(uid)
      applyUser(u)
    } catch (e) {
      setPageError((e as Error).message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载选项（部门 / 角色）
  const loadOptions = async () => {
    try {
      const [deptRes, roleRes] = await Promise.all([
        adminDeptApi.listAdminDepts({ page: 1, pageSize: 200 }),
        adminRoleApi.listAdminRoles({ page: 1, pageSize: 200 }),
      ])
      setDepts(deptRes.data || [])
      setRoles(roleRes.data || [])
    } catch {
      // 选项加载失败不阻塞
    }
  }

  const applyUser = (u: AdminUser) => {
    setUsername(u.username || '')
    setNickname(u.nickname || '')
    setRealName(u.realName || '')
    setPhone(u.phone || '')
    setEmail(u.email || '')
    setPassword('')
    setGender((u.gender as '0' | '1' | '2') || '0')
    setStatus((u.status as '0' | '1' | '2') || '1')
    setDeptIds(u.deptIds || [])
    setRoleIds(u.roleIds || [])
  }

  useEffect(() => {
    if (id) loadUser(id)
    loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const genderLabel = useMemo(
    () => ({ '0': '保密', '1': '男', '2': '女' } as const)[gender],
    [gender],
  )
  const statusLabel = useMemo(
    () => ({ '0': '禁用', '1': '启用', '2': '锁定' } as const)[status],
    [status],
  )

  const showGenderPicker = () => {
    Taro.showActionSheet({
      itemList: ['保密', '男', '女'],
      success: (res) => {
        setGender((['0', '1', '2'] as const)[res.tapIndex])
      },
    })
  }

  const showStatusPicker = () => {
    Taro.showActionSheet({
      itemList: ['启用', '禁用', '锁定'],
      success: (res) => {
        setStatus((['1', '0', '2'] as const)[res.tapIndex])
      },
    })
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!isEdit) {
      if (!username || username.length < 2) {
        next.username = '用户名至少 2 位'
      } else if (username.length > 50) {
        next.username = '用户名最多 50 位'
      }
    }
    if (!phone) {
      next.phone = '请输入手机号'
    } else if (!/^1[3-9]\d{9}$/.test(phone)) {
      next.phone = '手机号格式不正确'
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = '邮箱格式不正确'
    }
    if (!isEdit) {
      if (!password) {
        next.password = '请输入密码'
      } else if (password.length < 6) {
        next.password = '密码至少 6 位'
      } else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        next.password = '密码必须含字母+数字'
      }
    } else if (password) {
      if (password.length < 6) {
        next.password = '密码至少 6 位'
      } else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        next.password = '密码必须含字母+数字'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      if (isEdit && id) {
        const data: UpdateAdminUserReq = {
          nickname: nickname || undefined,
          realName: realName || undefined,
          email: email || undefined,
          gender,
          status,
          deptIds: deptIds.length > 0 ? deptIds : undefined,
          roleIds: roleIds.length > 0 ? roleIds : undefined,
        }
        if (password) data.password = password
        await adminUserApi.updateAdminUser(id, data)
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => navigateBack(1), 600)
      } else {
        const data: CreateAdminUserReq = {
          username,
          password,
          phone,
          nickname: nickname || undefined,
          realName: realName || undefined,
          email: email || undefined,
          gender,
          status,
          deptIds: deptIds.length > 0 ? deptIds : undefined,
          roleIds: roleIds.length > 0 ? roleIds : undefined,
        }
        await adminUserApi.createAdminUser(data)
        Taro.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => navigateBack(1), 600)
      }
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleDept = (deptId: number) => {
    setDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((x) => x !== deptId) : [...prev, deptId],
    )
  }
  const toggleRole = (roleId: number) => {
    setRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((x) => x !== roleId) : [...prev, roleId],
    )
  }

  const kind: 'loading' | 'error' | 'ready' = pageError
    ? 'error'
    : isEdit && loading
      ? 'loading'
      : 'ready'

  return (
    <View className="page-container">
      <PageHeader title={isEdit ? '编辑用户' : '新建用户'} />

      <StateView
        kind={kind}
        text={pageError || undefined}
        onRetry={id ? () => loadUser(id) : undefined}
        minHeight={300}
      >
        <View className={styles.edit}>
          <Card>
            <FormField
              type="input"
              label="用户名"
              required
              value={username}
              placeholder="2-50 位"
              maxLength={50}
              disabled={isEdit}
              onInput={setUsername}
              error={errors.username}
              hint={isEdit ? '用户名不可修改' : undefined}
            />
            <FormField
              type="input"
              label="真实姓名"
              value={realName}
              placeholder="选填"
              maxLength={50}
              onInput={setRealName}
            />
            <FormField
              type="input"
              label="昵称"
              value={nickname}
              placeholder="选填"
              maxLength={50}
              onInput={setNickname}
            />
          </Card>

          <View style={{ height: 12 }} />

          <Card>
            <FormField
              type="input"
              label="手机号"
              required
              value={phone}
              inputType="phone"
              placeholder="11 位手机号"
              maxLength={11}
              onInput={setPhone}
              error={errors.phone}
            />
            <FormField
              type="input"
              label="邮箱"
              value={email}
              placeholder="选填"
              onInput={setEmail}
              error={errors.email}
            />
            <FormField
              type="input"
              label={isEdit ? '新密码' : '密码'}
              required={!isEdit}
              value={password}
              password
              placeholder={isEdit ? '留空表示不修改' : '6-50 位，必须含字母+数字'}
              maxLength={50}
              onInput={setPassword}
              error={errors.password}
            />
          </Card>

          <View style={{ height: 12 }} />

          <Card>
            <FormField
              type="picker"
              label="性别"
              value={genderLabel}
              onClick={showGenderPicker}
            />
            <FormField
              type="picker"
              label="状态"
              value={statusLabel}
              onClick={showStatusPicker}
            />
          </Card>

          <View style={{ height: 12 }} />

          <Card padded>
            <View style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AppText size={14} variant="secondary">
                部门
              </AppText>
              {depts.length === 0 ? (
                <AppText size={12} variant="tertiary">
                  {loading ? '加载中…' : '暂无部门'}
                </AppText>
              ) : (
                <View className={styles.edit__chips}>
                  {depts.map((d) => (
                    <View
                      key={d.id}
                      className={[
                        styles.edit__chip,
                        deptIds.includes(d.id) ? styles['edit__chip--active'] : '',
                      ].join(' ')}
                      onClick={() => toggleDept(d.id)}
                    >
                      <Text className={styles.edit__chipText}>{d.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card>

          <View style={{ height: 12 }} />

          <Card padded>
            <View style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AppText size={14} variant="secondary">
                角色
              </AppText>
              {roles.length === 0 ? (
                <AppText size={12} variant="tertiary">
                  {loading ? '加载中…' : '暂无角色'}
                </AppText>
              ) : (
                <View className={styles.edit__chips}>
                  {roles.map((r) => (
                    <View
                      key={r.id}
                      className={[
                        styles.edit__chip,
                        roleIds.includes(r.id) ? styles['edit__chip--active'] : '',
                      ].join(' ')}
                      onClick={() => toggleRole(r.id)}
                    >
                      <Text className={styles.edit__chipText}>{r.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card>

          {deptIds.length > 0 || roleIds.length > 0 ? (
            <View style={{ padding: '8px 16px' }}>
              <View style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {deptIds.map((id) => {
                  const d = depts.find((x) => x.id === id)
                  return d ? <Tag key={`d-${id}`} variant="primary">部门：{d.name}</Tag> : null
                })}
                {roleIds.map((id) => {
                  const r = roles.find((x) => x.id === id)
                  return r ? <Tag key={`r-${id}`} variant="success">角色：{r.name}</Tag> : null
                })}
              </View>
            </View>
          ) : null}
        </View>
      </StateView>

      <BottomActionBar>
        <Button block loading={submitting} onClick={handleSubmit}>
          保存
        </Button>
      </BottomActionBar>
    </View>
  )
}
