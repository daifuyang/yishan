import { useState, useEffect, useMemo, useRef } from 'react'
import Taro, { useRouter, useDidShow, useDidHide } from '@tarojs/taro'

import { Tag } from '@/components/atoms'
import { PageHeader } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import {
  ManagementPage,
  DetailContent,
  DetailHero,
  DetailSection,
  DetailRow,
  BottomActionBar,
  ActionSheet,
  PromptDialog,
  type BottomAction,
  type ActionSheetItem,
} from '@/components/management'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo, navigateBack } from '@/utils/router'
import { useCanWrite, confirmAction } from '@/hooks'
import { adminUserApi, adminRoleApi, adminDeptApi } from '@/api'
import type { AdminUser } from '@/api/admin/types'
import { PERMS, SYSTEM_PAGES } from '@/constants/routes'
import { formatDateTime } from '@/utils/format'
import { buildProfileSections, formatOrgSummary, maskSecret, UNSET } from '../profileSections'
import { withAccountScope } from '../../_shared/AdminUI'

function UserDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-user' })
  const router = useRouter()
  const id = Number(router.params.id)
  const canUpdate = useCanWrite(PERMS.userUpdate)
  const canDelete = useCanWrite(PERMS.userDelete)
  const canReadRoles = useCanWrite('system:role:list')
  const canReadDepts = useCanWrite(PERMS.deptList)

  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleNames, setRoleNames] = useState<Record<number, string>>({})
  const [deptNames, setDeptNames] = useState<Record<number, string>>({})
  const [moreOpen, setMoreOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const submittingRef = useRef(false)
  const loadSequence = useRef(0)
  const refreshOnShow = useRef(false)

  const load = async () => {
    if (!guard.ready || !guard.allowed || submittingRef.current) return
    const sequence = ++loadSequence.current
    if (!Number.isInteger(id) || id <= 0) {
      setError('用户ID缺失或无效')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await adminUserApi.getAdminUser(id)
      if (sequence === loadSequence.current) setUser(data)
    } catch (e) {
      if (sequence === loadSequence.current) setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }

  useEffect(() => {
    setUser(null)
    void load()
    return () => {
      loadSequence.current++
    }
  }, [id, guard.ready, guard.allowed])

  useDidShow(() => {
    if (refreshOnShow.current) {
      refreshOnShow.current = false
      void load()
    }
  })

  useDidHide(() => {
    refreshOnShow.current = true
    setMoreOpen(false)
    setPasswordOpen(false)
    setPassword('')
  })

  const roleKey = user?.roleIds?.join(',') || ''
  const deptKey = user?.deptIds?.join(',') || ''
  useEffect(() => {
    let active = true
    setRoleNames({})
    setDeptNames({})
    const resolveNames = async (
      ids: string,
      allowed: boolean,
      fetchName: (value: number) => Promise<{ id: number; name: string }>,
      setNames: (names: Record<number, string>) => void,
    ) => {
      if (!ids || !allowed || !guard.allowed) return
      const results = await Promise.allSettled(
        ids.split(',').map((value) => fetchName(Number(value))),
      )
      const names: Record<number, string> = {}
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.name) names[result.value.id] = result.value.name
      }
      if (active) setNames(names)
    }
    void resolveNames(roleKey, canReadRoles, adminRoleApi.getAdminRole, setRoleNames)
    void resolveNames(deptKey, canReadDepts, adminDeptApi.getAdminDept, setDeptNames)
    return () => {
      active = false
    }
  }, [roleKey, deptKey, canReadRoles, canReadDepts, guard.allowed])

  // 详情页与编辑页共用同一份字段契约，分组/顺序/空值文案只在这里定义一次
  const sections = useMemo(
    () =>
      buildProfileSections({
        user: (user ?? {}) as unknown as Record<string, unknown>,
        deptNames: new Map(Object.entries(deptNames).map(([id, name]) => [Number(id), name])),
        roleNames: new Map(Object.entries(roleNames).map(([id, name]) => [Number(id), name])),
        canReadDepts,
        canReadRoles,
      }),
    [user, deptNames, roleNames, canReadDepts, canReadRoles],
  )

  const handleEdit = () => {
    if (!user || !canUpdate || submittingRef.current || loading) return
    navigateTo(`/${SYSTEM_PAGES.userEdit}?id=${user.id}`)
  }

  const handleToggleStatus = async () => {
    if (!user || !canUpdate || submittingRef.current || loading) return
    submittingRef.current = true
    setSubmitting(true)
    const next = user.status === '1' ? '0' : '1'
    try {
      const ok = await confirmAction({
        title: next === '1' ? '启用用户' : '禁用用户',
        content: `确认要${next === '1' ? '启用' : '禁用'}「${user.realName || user.username || user.phone}」吗？`,
        confirmText: next === '1' ? '启用' : '禁用',
        confirmColor: next === '1' ? '#1677FF' : '#F53F3F',
      })
      if (!ok) return
      const updated = await adminUserApi.updateAdminUser(user.id, { status: next })
      setUser(updated)
      Taro.showToast({ title: '操作成功', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (input?: string) => {
    if (!user || !canUpdate || submittingRef.current || loading) return
    setMoreOpen(false)
    if (process.env.TARO_ENV === 'h5' && input === undefined) {
      setPassword('')
      setPasswordError('')
      setPasswordOpen(true)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      let newPassword = input?.trim() || ''
      if (input === undefined) {
        // 微信支持 editable/content，当前 Taro 公共声明未包含这两个扩展字段。
        const res = await Taro.showModal({
          title: '重置密码',
          content: `为「${user.realName || user.username || user.phone}」设置新密码（6-50 位，必须含字母+数字）`,
          editable: true,
          placeholderText: '新密码',
          confirmText: '确定',
          confirmColor: '#1677FF',
        } as Parameters<typeof Taro.showModal>[0])
        if (!res.confirm) return
        newPassword = ((res as { content?: string }).content || '').trim()
      }
      setPasswordError('')
      if (newPassword.length < 6 || newPassword.length > 50) {
        setPasswordError('密码须为 6-50 位')
        Taro.showToast({ title: '密码须为 6-50 位', icon: 'none' })
        return
      }
      if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
        setPasswordError('密码必须含字母+数字')
        Taro.showToast({ title: '密码必须含字母+数字', icon: 'none' })
        return
      }
      await adminUserApi.resetAdminUserPassword(user.id, newPassword)
      setPasswordOpen(false)
      setPassword('')
      Taro.showToast({ title: '密码已重置', icon: 'success' })
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : '重置失败')
      Taro.showToast({ title: e instanceof Error ? e.message : '重置失败', icon: 'none' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !canDelete || submittingRef.current || loading) return
    if (user.id === 1) {
      Taro.showToast({ title: '系统管理员不可删除', icon: 'none' })
      return
    }
    setMoreOpen(false)
    submittingRef.current = true
    setSubmitting(true)
    try {
      const ok = await confirmAction({
        title: '删除用户',
        content: `确认删除「${user.realName || user.username || user.phone}」？该操作不可恢复。`,
        confirmText: '删除',
        confirmColor: '#F53F3F',
      })
      if (!ok) return
      await adminUserApi.deleteAdminUser(user.id)
      setUser(null)
      Taro.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => navigateBack(1), 600)
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '删除失败', icon: 'none' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const kind = error ? 'error' : loading && !user ? 'loading' : !user ? 'empty' : 'ready'
  const hasMore = canUpdate || (canDelete && user?.id !== 1)
  const disabled = submitting || loading
  const lastLoginIp = user?.lastLoginIp
  const loginIp =
    lastLoginIp && ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(lastLoginIp) ? '本机地址' : lastLoginIp

  const actions: BottomAction[] = [
    ...(canUpdate
      ? [
          { key: 'edit', label: '编辑', icon: 'pencil' as const, tone: 'primary' as const, onClick: handleEdit },
          {
            key: 'toggle',
            label: user?.status === '1' ? '禁用' : '启用',
            icon: (user?.status === '1' ? 'ban' : 'check') as 'ban' | 'check',
            tone: (user?.status === '1' ? 'warning' : 'primary') as 'warning' | 'primary',
            onClick: () => void handleToggleStatus(),
          },
        ]
      : []),
    ...(hasMore
      ? [
          {
            key: 'more',
            label: '更多操作',
            icon: 'ellipsis' as const,
            tone: 'muted' as const,
            onClick: () => setMoreOpen(true),
          },
        ]
      : []),
  ]

  const sheetItems: ActionSheetItem[] = [
    ...(canUpdate
      ? [
          {
            key: 'password',
            label: '重置密码',
            icon: 'keyRound' as const,
            onClick: () => void handleResetPassword(),
          },
        ]
      : []),
    ...(canDelete && user?.id !== 1
      ? [{ key: 'delete', label: '删除用户', icon: 'trash' as const, danger: true, onClick: () => void handleDelete() }]
      : []),
  ]

  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="用户详情" /> : null}
      <DetailContent>
        <StateView
          kind={kind}
          text={error || (kind === 'empty' ? '用户不存在' : undefined)}
          onRetry={load}
          minHeight={300}
        >
          {user ? (
            <>
              <DetailHero
                avatar={{ src: user.avatar, name: user.realName || user.username || user.phone }}
                title={user.realName || user.username || user.phone}
                tag={
                  <Tag
                    variant={
                      user.status === '1' ? 'success' : user.status === '0' ? 'default' : 'warning'
                    }
                  >
                    {user.status === '1' ? '启用' : user.status === '0' ? '禁用' : '锁定'}
                  </Tag>
                }
                subtitle={user.username ? `@${user.username}` : undefined}
              />
              {sections.map((section) => (
                <DetailSection key={section.key} title={section.title}>
                  {section.fields.map((field) => (
                    <DetailRow
                      key={field.key}
                      label={field.label}
                      // 详情页只做展示：组织关系不提供跳转，避免只读浏览误导为可编辑
                      value={
                        field.kind === 'org'
                          ? formatOrgSummary(field.ids, field.names)
                          : field.kind === 'secret'
                            ? // 已存在用户的密码必然已设置，一律打码，不暴露也不误报「未设置」
                              maskSecret(field.value) || '••••••••'
                            : field.kind === 'enum'
                              ? (field.options[Number(field.value)] ?? field.value)
                              : field.value
                      }
                      tone={
                        field.kind === 'org'
                          ? field.ids.length
                            ? 'default'
                            : 'muted'
                          : field.value === UNSET
                            ? 'muted'
                            : 'default'
                      }
                    />
                  ))}
                </DetailSection>
              ))}
              <DetailSection title="账号记录" collapsible defaultCollapsed>
                <DetailRow label="用户 ID" value={user.id} />
                <DetailRow
                  label="最后登录"
                  value={user.lastLoginTime ? formatDateTime(user.lastLoginTime) : '未登录'}
                />
                <DetailRow label="登录次数" value={user.loginCount} />
                <DetailRow label="创建人" value={user.creatorName} />
                <DetailRow label="登录 IP" value={loginIp} />
                <DetailRow label="创建时间" value={formatDateTime(user.createdAt)} />
                <DetailRow label="更新人" value={user.updaterName} />
                <DetailRow label="更新时间" value={formatDateTime(user.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>

      <BottomActionBar actions={actions} disabled={disabled} />
      <ActionSheet open={moreOpen} items={sheetItems} onClose={() => setMoreOpen(false)} />
      <PromptDialog
        open={passwordOpen && Boolean(user) && canUpdate}
        title="重置密码"
        hint={`为「${user?.realName || user?.username || user?.phone}」设置新密码，6-50 位，必须含字母和数字。`}
        value={password}
        placeholder="新密码"
        error={passwordError}
        password
        submitting={submitting}
        confirmAriaLabel="确认重置密码"
        cancelAriaLabel="取消重置密码"
        onChange={setPassword}
        onSubmit={() => void handleResetPassword(password)}
        onClose={() => {
          setPasswordOpen(false)
          setPassword('')
        }}
      />
    </ManagementPage>
  )
}

export default withAccountScope(UserDetailPage)