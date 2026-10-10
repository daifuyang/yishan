import { useMemo } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { AppText, Avatar, Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import { TabBar } from '@/components/organisms'
import { useListPagination, useCanWrite, confirmAction } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { PageContainer } from '@/components/layout'
import { navigateBack, navigateTo } from '@/utils/router'
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

const SKELETON_ROWS = ['first', 'second', 'third'] as const

function UserPageHeader({ total, canCreate }: { total: number; canCreate: boolean }) {
  return (
    <View className={styles.userHeader}>
      <View
        className={styles.userHeader__back}
        onClick={() => navigateBack(1)}
        hoverClass={styles.userHeader__backHover}
        aria-label="返回"
      >
        <Text className={styles.userHeader__backIcon}>‹</Text>
      </View>
      <View className={styles.userHeader__titleWrap}>
        <Text className={styles.userHeader__title}>用户管理</Text>
        <Text className={styles.userHeader__subtitle}>{total} 位成员</Text>
      </View>
      <View className={styles.userHeader__right}>
        {canCreate ? (
          <View
            className={styles.userHeader__create}
            onClick={() => navigateTo(`/${SYSTEM_PAGES.userEdit}`)}
            hoverClass={styles.userHeader__createHover}
          >
            <Text className={styles.userHeader__createIcon}>+</Text>
            <Text>新建</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function UserListSkeleton() {
  return (
    <View className={styles.userList} aria-label="加载中">
      {SKELETON_ROWS.map((row) => (
        <View className={styles.userSkeleton} key={row}>
          <View className={styles.userSkeleton__avatar} />
          <View className={styles.userSkeleton__content}>
            <View className={styles.userSkeleton__name} />
            <View className={styles.userSkeleton__meta} />
          </View>
        </View>
      ))}
    </View>
  )
}

export default function UserIndexPage() {
  const guard = useRequireAuth({ moduleId: 'system-user' })
  const canCreate = useCanWrite(PERMS.userCreate)
  const canUpdate = useCanWrite(PERMS.userUpdate)
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
    enabled: guard.ready && guard.allowed,
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

  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>

  const handleLongPress = async (user: AdminUser) => {
    if (!canUpdate && !canDelete) return
    const items: string[] = []
    if (canUpdate) {
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
      <UserPageHeader total={total} canCreate={canCreate} />

      <View className={styles.userFilters}>
        <View className={styles.userSearch}>
          <Text className={styles.userSearch__icon}>⌕</Text>
          <Input
            className={styles.userSearch__input}
            value={keyword}
            placeholder="搜索用户"
            onInput={(event) => setKeyword(event.detail.value)}
          />
          {keyword ? (
            <View
              className={styles.userSearch__clear}
              onClick={() => setKeyword('')}
              hoverClass={styles.userSearch__clearHover}
              aria-label="清除搜索"
            >
              <Text className={styles.userSearch__clearIcon}>×</Text>
            </View>
          ) : null}
        </View>
        <View className={styles.userFilters__chips}>
          {statusChips.map((chip) => (
            <View
              key={chip.key || 'all'}
              className={[styles.userChip, chip.active ? styles['userChip--active'] : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => setFilters({ status: chip.key })}
              hoverClass={styles.userChip__hover}
            >
              <Text>{chip.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {kind === 'loading' ? <UserListSkeleton /> : null}
      {kind === 'empty' ? (
        <StateView
          kind="empty"
          text={keyword ? '未找到相关用户' : '暂无用户'}
          minHeight={220}
        />
      ) : null}
      {kind === 'error' ? (
        <StateView kind="error" text="加载失败，请重试" onRetry={refresh} minHeight={220} />
      ) : null}
      {kind === 'ready' ? (
        <View className={styles.userList}>
          {list.map((u, index) => {
            const displayName = u.realName || u.username || u.phone
            const metadata = [u.username ? `@${u.username}` : '', u.phone || '']
              .filter(Boolean)
              .join(' · ')
            const status =
              u.status === '1'
                ? { label: '启用', variant: 'success' as const }
                : u.status === '0'
                  ? { label: '禁用', variant: 'default' as const }
                  : { label: '锁定', variant: 'warning' as const }

            const longPressProps =
              process.env.TARO_ENV !== 'h5'
                ? { onLongPress: () => handleLongPress(u) }
                : undefined

            return (
              <View
                key={u.id}
                className={[styles.userRow, index < list.length - 1 ? styles['userRow--bordered'] : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleItemClick(u)}
                hoverClass={styles.userRow__hover}
                {...longPressProps}
              >
                <Avatar
                  src={u.avatar}
                  name={displayName}
                  size="md"
                  shape="circle"
                  className={styles.userRow__avatar}
                />
                <View className={styles.userRow__content}>
                  <View className={styles.userRow__nameLine}>
                    <Text className={styles.userRow__name}>{displayName}</Text>
                    <Tag variant={status.variant} size="sm" className={styles.userRow__status}>
                      {status.label}
                    </Tag>
                  </View>
                  {metadata ? <Text className={styles.userRow__meta}>{metadata}</Text> : null}
                </View>
                <Text className={styles.userRow__arrow}>›</Text>
              </View>
            )
          })}
        </View>
      ) : null}

      {kind === 'ready' && !finished && list.length > 0 ? (
        <View className={styles.userList__loadingMore}>
          <AppText size={12} variant="tertiary">
            {loadingMore ? '加载中…' : '上拉加载更多'}
          </AppText>
        </View>
      ) : null}
      {refreshing && kind === 'ready' ? (
        <View className={styles.userList__loadingMore}>
          <AppText size={12} variant="tertiary">
            刷新中…
          </AppText>
        </View>
      ) : null}

      <TabBar currentPath={TAB_PAGES.apps} />
    </View>
  )
}
