import { useState, useEffect, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { Avatar, Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import { useListPagination, useCanWrite, confirmAction } from '@/hooks'
import { navigateTo } from '@/utils/router'
import { adminUserApi } from '@/api'
import { PERMS, SYSTEM_PAGES } from '@/constants/routes'
import type { AdminUser, AdminUserListQuery } from '@/api/admin/types'
import { STATUS_CHIPS, USER_STATUS_CONFIG, type UserStatus } from './constants'
import type { WorkbenchUserPanelProps } from './types'
export type { WorkbenchUserPanelProps }

import styles from './WorkbenchUserPanel.module.scss'

function UserPanelHeader({
  expanded,
  onToggle,
  count,
}: {
  expanded: boolean
  onToggle: () => void
  count: number
}) {
  const arrowClass = expanded
    ? `${styles.oUserPanel__arrow} ${styles['oUserPanel__arrow--expanded']}`
    : styles.oUserPanel__arrow

  return (
    <View className={styles.oUserPanel__header} onClick={onToggle}>
      <View className={styles.oUserPanel__headerLeft}>
        <Text className={styles.oUserPanel__title}>用户管理</Text>
        {count > 0 && (
          <Text className={styles.oUserPanel__count}>({count})</Text>
        )}
      </View>
      <Text className={arrowClass}>▼</Text>
    </View>
  )
}

function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <View className={styles.oUserPanel__filter}>
      <Input
        className="at-input"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          fontSize: '13px',
        }}
        placeholder="搜索用户名 / 姓名 / 手机"
        value={value}
        onInput={(e) => onChange(e.detail.value)}
      />
    </View>
  )
}

function StatusFilter({
  active,
  onChange,
}: {
  active: string
  onChange: (v: string) => void
}) {
  return (
    <View
      style={{
        display: 'flex',
        gap: '8px',
        padding: '0 12px 12px',
        flexWrap: 'wrap',
      }}
    >
      {STATUS_CHIPS.map((chip) => (
        <View
          key={chip.key}
          onClick={() => onChange(chip.key)}
          style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            backgroundColor:
              active === chip.key
                ? 'var(--color-primary-bg)'
                : 'var(--color-bg-secondary)',
            color:
              active === chip.key
                ? 'var(--color-primary)'
                : 'var(--color-text-secondary)',
          }}
        >
          {chip.label}
        </View>
      ))}
    </View>
  )
}

function UserListItem({
  user,
  onClick,
  onLongPress,
}: {
  user: AdminUser
  onClick: () => void
  onLongPress: () => void
}) {
  const displayName = user.realName || user.username || user.phone || '-'
  const subText = `@${user.username || '-'} · ${user.phone || '-'}`
  const statusConfig = USER_STATUS_CONFIG[user.status as UserStatus] || USER_STATUS_CONFIG['0']

  return (
    <View
      className={styles.oUserPanel__item}
      onClick={onClick}
      onLongPress={onLongPress}
    >
      <View className={styles.oUserPanel__avatar}>
        <Avatar
          src={user.avatar}
          name={displayName}
          size="sm"
          shape="circle"
        />
      </View>
      <View className={styles.oUserPanel__info}>
        <Text className={styles.oUserPanel__name}>{displayName}</Text>
        <Text className={styles.oUserPanel__sub}>{subText}</Text>
      </View>
      <View className={styles.oUserPanel__status}>
        <Tag variant={statusConfig.variant} size="sm">
          {statusConfig.label}
        </Tag>
      </View>
    </View>
  )
}

export function WorkbenchUserPanel({ expanded, onToggle }: WorkbenchUserPanelProps) {
  const canWrite = useCanWrite(PERMS.userWrite)
  const canDelete = useCanWrite(PERMS.userDelete)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const {
    list,
    total,
    loading,
    loadingMore,
    finished,
    error,
    refresh,
    loadMore,
  } = useListPagination<AdminUser>({
    fetcher: async ({ page, pageSize, filters }) => {
      const query: AdminUserListQuery = {
        page,
        pageSize,
        keyword: searchKeyword || undefined,
        status: (filters.status as '0' | '1' | '2' | undefined) || undefined,
      }
      const { data, pagination } = await adminUserApi.listAdminUsers(query)
      return { list: data, total: pagination.total }
    },
    initialKeyword: '',
    initialFilters: { status: '' },
    keywordDebounce: 300,
  })

  useEffect(() => {
    if (expanded && list.length === 0 && !loading) {
      void refresh()
    }
  }, [expanded])

  const handleSearchChange = useCallback((value: string) => {
    setSearchKeyword(value)
  }, [])

  const handleStatusChange = useCallback(
    (status: string) => {
      setStatusFilter(status)
    },
    [],
  )

  const handleItemClick = useCallback(
    (user: AdminUser) => {
      navigateTo(`/${SYSTEM_PAGES.userDetail}?id=${user.id}`)
    },
    [],
  )

  const handleLongPress = useCallback(
    async (user: AdminUser) => {
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
    },
    [canWrite, canDelete],
  )

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

  const bodyClass = expanded
    ? `${styles.oUserPanel__body} ${styles['oUserPanel__body--expanded']}`
    : styles.oUserPanel__body

  return (
    <View className={styles.oUserPanel}>
      <UserPanelHeader
        expanded={expanded}
        onToggle={onToggle}
        count={total}
      />
      <View className={bodyClass}>
        {expanded && (
          <>
            <SearchBar value={searchKeyword} onChange={handleSearchChange} />
            <StatusFilter active={statusFilter} onChange={handleStatusChange} />
            <View className={styles.oUserPanel__list}>
              <StateView
                kind={kind}
                text={error || (kind === 'empty' ? '暂无用户' : undefined)}
                onRetry={refresh}
                minHeight={200}
              >
                {list.map((user) => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    onClick={() => handleItemClick(user)}
                    onLongPress={() => handleLongPress(user)}
                  />
                ))}
              </StateView>
            </View>
            {!finished && list.length > 0 && (
              <View className={styles.oUserPanel__loadingMore}>
                <Text onClick={() => void loadMore()}>
                  {loadingMore ? '加载中…' : '上拉加载更多'}
                </Text>
              </View>
            )}
            {finished && list.length > 0 && (
              <View className={styles.oUserPanel__loadingMore}>
                <Text>没有更多了</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  )
}

export default WorkbenchUserPanel