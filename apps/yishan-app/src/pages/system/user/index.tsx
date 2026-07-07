import { useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { AppText, Avatar, Tag } from '@/components/atoms'
import { PageHeader, ListFilter, ListItem } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { TabBar } from '@/components/organisms'
import { useListPagination, useCanWrite, confirmAction } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { adminUserApi } from '@/api'
import type { AdminUser, AdminUserListQuery } from '@/api/admin/types'
import { PERMS, SYSTEM_PAGES, TAB_PAGES } from '@/constants/routes'

import styles from './index.module.scss'

const STATUS_CHIPS = [
  { key: '', label: '全部' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
  { key: '2', label: '锁定' },
] as const

export default function UserIndexPage() {
  useRequireAuth()
  const canWrite = useCanWrite(PERMS.userWrite)
  const canDelete = useCanWrite(PERMS.userDelete)

  const {
    list,
    total,
    loading,
    refreshing,
    loadingMore,
    finished,
    error,
    keyword,
    filters,
    setKeyword,
    setFilters,
    refresh,
  } = useListPagination<AdminUser>({
    fetcher: async ({ page, pageSize, keyword: kw, filters: fs }) => {
      const query: AdminUserListQuery = {
        page,
        pageSize,
        keyword: kw || undefined,
        status: (fs.status as '0' | '1' | '2' | undefined) || undefined,
      }
      const { data, pagination } = await adminUserApi.listAdminUsers(query)
      return { list: data, total: pagination.total }
    },
  })

  const statusChips = useMemo(
    () =>
      STATUS_CHIPS.map((c) => ({
        key: c.key,
        label: c.label,
        active: (filters.status ?? '') === c.key,
      })),
    [filters.status],
  )

  const handleItemClick = (user: AdminUser) => {
    navigateTo(`/${SYSTEM_PAGES.userDetail}?id=${user.id}`)
  }

  const handleLongPress = async (user: AdminUser) => {
    if (!canWrite && !canDelete) return
    const items: string[] = []
    if (canWrite) {
      items.push(user.status === '1' ? '禁用' : '启用')
      items.push('重置密码')
    }
    if (canDelete && user.id !== 1) {
      items.push('删除')
    }
    if (items.length === 0) return

    const res = await Taro.showActionSheet({
      itemList: items,
      alertText: `${user.realName || user.username || user.phone} (ID: ${user.id})`,
    })
    const action = items[res.tapIndex]
    if (action === '禁用' || action === '启用') {
      await toggleStatus(user)
    } else if (action === '重置密码') {
      await resetPassword(user)
    } else if (action === '删除') {
      await deleteUser(user)
    }
  }

  const toggleStatus = async (user: AdminUser) => {
    const next = user.status === '1' ? '0' : '1'
    const ok = await confirmAction({
      title: next === '1' ? '启用用户' : '禁用用户',
      content: `确认要${next === '1' ? '启用' : '禁用'}「${user.realName || user.username || user.phone}」吗？`,
      confirmText: next === '1' ? '启用' : '禁用',
      confirmColor: next === '1' ? '#1677FF' : '#F53F3F',
    })
    if (!ok) return
    try {
      await adminUserApi.updateAdminUser(user.id, { status: next as '0' | '1' })
      Taro.showToast({ title: '操作成功', icon: 'success' })
      await refresh()
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '操作失败', icon: 'none' })
    }
  }

  const resetPassword = async (user: AdminUser) => {
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

  const deleteUser = async (user: AdminUser) => {
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
      await refresh()
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '删除失败', icon: 'none' })
    }
  }

  const kind: 'loading' | 'error' | 'empty' | 'ready' = error
    ? 'error'
    : loading && list.length === 0
      ? 'loading'
      : list.length === 0
        ? 'empty'
        : 'ready'

  return (
    <View className="page-container">
      <PageHeader
        title="用户管理"
        subtitle={`共 ${total} 人`}
        right={
          canWrite ? (
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
              onClick={() => navigateTo(`/${SYSTEM_PAGES.userEdit}`)}
            >
              + 新建
            </View>
          ) : undefined
        }
      />

      <ListFilter
        searchPlaceholder="搜索用户名 / 姓名 / 手机 / 邮箱"
        keyword={keyword}
        onSearchChange={setKeyword}
        chips={statusChips}
        onChipClick={(k) => setFilters({ status: k })}
      />

      <View className={styles.userList}>
        <StateView
          kind={kind}
          text={error || (kind === 'empty' ? '暂无用户' : undefined)}
          onRetry={refresh}
          minHeight={300}
        >
          {list.map((u) => (
            <ListItem
              key={u.id}
              icon={
                <Avatar
                  src={u.avatar}
                  name={u.realName || u.username || u.phone}
                  size="sm"
                  shape="circle"
                />
              }
              title={
                <View className={styles.userList__title}>
                  <Text className={styles.userList__name}>
                    {u.realName || u.username || u.phone}
                  </Text>
                  <Text className={styles.userList__sub}>@{u.username || '-'} · {u.phone}</Text>
                </View>
              }
              value={
                <View className={styles.userList__value}>
                  {u.status === '1' ? (
                    <Tag variant="success">启用</Tag>
                  ) : u.status === '0' ? (
                    <Tag variant="default">禁用</Tag>
                  ) : (
                    <Tag variant="warning">锁定</Tag>
                  )}
                </View>
              }
              showArrow
              bordered
              onClick={() => handleItemClick(u)}
              // 长按弹操作表
              // @ts-expect-error onLongPress 在 Taro View 中存在
              onLongPress={() => handleLongPress(u)}
            />
          ))}
        </StateView>

        {!finished && list.length > 0 ? (
          <View className={styles.userList__loadingMore}>
            <AppText size={12} variant="tertiary">
              {loadingMore ? '加载中…' : '上拉加载更多'}
            </AppText>
          </View>
        ) : null}
        {refreshing ? (
          <View className={styles.userList__loadingMore}>
            <AppText size={12} variant="tertiary">刷新中…</AppText>
          </View>
        ) : null}
      </View>

      <TabBar currentPath={TAB_PAGES.apps} />
    </View>
  )
}
