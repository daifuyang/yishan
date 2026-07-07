import { useState, useEffect } from 'react'
import { View } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'

import { AppText, Avatar, Tag, Button } from '@/components/atoms'
import { PageHeader, Card, ListItem } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo, navigateBack } from '@/utils/router'
import { useCanWrite, useCanWrite as _ucw, confirmAction } from '@/hooks'
import { adminUserApi } from '@/api'
import { PERMS, SYSTEM_PAGES } from '@/constants/routes'
import { formatDateTime } from '@/utils/format'

import styles from './index.module.scss'

export default function UserDetailPage() {
  useRequireAuth()
  const router = useRouter()
  const id = Number(router.params.id)
  const canWrite = useCanWrite(PERMS.userWrite)
  const canDelete = _ucw(PERMS.userDelete)

  const [user, setUser] = useState<Awaited<ReturnType<typeof adminUserApi.getAdminUser>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!id) {
      setError('用户ID缺失')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await adminUserApi.getAdminUser(id)
      setUser(data)
    } catch (e) {
      setError((e as Error).message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useDidShow(() => load())

  const handleEdit = () => {
    if (!user) return
    navigateTo(`/${SYSTEM_PAGES.userEdit}?id=${user.id}`)
  }

  const handleToggleStatus = async () => {
    if (!user) return
    const next = user.status === '1' ? '0' : '1'
    const ok = await confirmAction({
      title: next === '1' ? '启用用户' : '禁用用户',
      content: `确认要${next === '1' ? '启用' : '禁用'}「${user.realName || user.username || user.phone}」吗？`,
      confirmText: next === '1' ? '启用' : '禁用',
      confirmColor: next === '1' ? '#1677FF' : '#F53F3F',
    })
    if (!ok) return
    try {
      const updated = await adminUserApi.updateAdminUser(user.id, { status: next as '0' | '1' })
      setUser(updated)
      Taro.showToast({ title: '操作成功', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '操作失败', icon: 'none' })
    }
  }

  const handleResetPassword = async () => {
    if (!user) return
    const res = await Taro.showModal({
      title: '重置密码',
      content: `为「${user.realName || user.username || user.phone}」设置新密码（6-50 位，必须含字母+数字）`,
      editable: true,
      placeholderText: '新密码',
      confirmText: '确定',
      confirmColor: '#1677FF',
    } as Parameters<typeof Taro.showModal>[0])
    if (!res.confirm) return
    const newPassword = ((res as { content?: string }).content || '').trim()
    if (newPassword.length < 6) {
      Taro.showToast({ title: '密码至少 6 位', icon: 'none' })
      return
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      Taro.showToast({ title: '密码必须含字母+数字', icon: 'none' })
      return
    }
    try {
      await adminUserApi.resetAdminUserPassword(user.id, newPassword)
      Taro.showToast({ title: '密码已重置', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '重置失败', icon: 'none' })
    }
  }

  const handleDelete = async () => {
    if (!user) return
    if (user.id === 1) {
      Taro.showToast({ title: '系统管理员不可删除', icon: 'none' })
      return
    }
    const ok = await confirmAction({
      title: '删除用户',
      content: `确认删除「${user.realName || user.username || user.phone}」？该操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#F53F3F',
    })
    if (!ok) return
    try {
      await adminUserApi.deleteAdminUser(user.id)
      Taro.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => navigateBack(1), 600)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '删除失败', icon: 'none' })
    }
  }

  const kind: 'loading' | 'error' | 'empty' | 'ready' = error
    ? 'error'
    : loading && !user
      ? 'loading'
      : !user
        ? 'empty'
        : 'ready'

  return (
    <View className="page-container">
      <PageHeader
        title="用户详情"
        subtitle={user ? `ID: ${user.id}` : ''}
        right={
          canWrite && user ? (
            <View
              style={{
                padding: '0 12px',
                height: 28,
                lineHeight: '28px',
                borderRadius: 4,
                background: 'var(--color-primary-bg)',
                color: 'var(--color-primary)',
                fontSize: 12,
              }}
              onClick={handleEdit}
            >
              编辑
            </View>
          ) : undefined
        }
      />

      <View className={styles.detail}>
        <StateView
          kind={kind}
          text={error || (kind === 'empty' ? '用户不存在' : undefined)}
          onRetry={load}
          minHeight={300}
        >
          {user ? (
            <>
              <Card padded>
                <View className={styles.detail__hero}>
                  <Avatar
                    src={user.avatar}
                    name={user.realName || user.username || user.phone}
                    size="lg"
                    shape="circle"
                  />
                  <View className={styles.detail__heroInfo}>
                    <AppText size={18} weight="semibold">
                      {user.realName || user.username || user.phone}
                    </AppText>
                    <AppText size={12} variant="tertiary" className={styles.detail__sub}>
                      @{user.username || '-'} · ID {user.id}
                    </AppText>
                    <View className={styles.detail__tags}>
                      {user.status === '1' ? (
                        <Tag variant="success">启用</Tag>
                      ) : user.status === '0' ? (
                        <Tag variant="default">禁用</Tag>
                      ) : (
                        <Tag variant="warning">锁定</Tag>
                      )}
                      {user.genderName ? <Tag variant="primary">{user.genderName}</Tag> : null}
                    </View>
                  </View>
                </View>
              </Card>

              <View style={{ height: 12 }} />

              <Card>
                <ListItem
                  title="手机号"
                  value={user.phone}
                  showArrow={false}
                />
                <ListItem
                  title="邮箱"
                  value={user.email || '-'}
                  showArrow={false}
                />
                <ListItem
                  title="昵称"
                  value={user.nickname || '-'}
                  showArrow={false}
                />
                <ListItem
                  title="出生日期"
                  value={user.birthDate || '-'}
                  showArrow={false}
                />
                <ListItem
                  title="角色"
                  value={
                    user.roleIds && user.roleIds.length > 0
                      ? user.roleIds.map(String).join(', ')
                      : '-'
                  }
                  showArrow={false}
                />
                <ListItem
                  title="部门"
                  value={
                    user.deptIds && user.deptIds.length > 0
                      ? user.deptIds.map(String).join(', ')
                      : '-'
                  }
                  showArrow={false}
                />
                <ListItem
                  title="最后登录"
                  value={
                    user.lastLoginTime
                      ? `${formatDateTime(user.lastLoginTime)} · ${user.lastLoginIp || '-'}`
                      : '-'
                  }
                  showArrow={false}
                />
                <ListItem
                  title="登录次数"
                  value={String(user.loginCount)}
                  showArrow={false}
                />
                <ListItem
                  title="创建人"
                  value={`${user.creatorName || '-'} · ${formatDateTime(user.createdAt)}`}
                  showArrow={false}
                />
                <ListItem
                  title="更新人"
                  value={`${user.updaterName || '-'} · ${formatDateTime(user.updatedAt)}`}
                  showArrow={false}
                  bordered={false}
                />
              </Card>
            </>
          ) : null}
        </StateView>
      </View>

      {user ? (
        <View className={styles.detail__actions}>
          {canWrite ? (
            <Button
              block
              variant="secondary"
              onClick={handleToggleStatus}
            >
              {user.status === '1' ? '禁用' : '启用'}
            </Button>
          ) : null}
          {canWrite ? (
            <Button block variant="secondary" onClick={handleResetPassword}>
              重置密码
            </Button>
          ) : null}
          {canDelete && user.id !== 1 ? (
            <Button block variant="danger" onClick={handleDelete}>
              删除用户
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
