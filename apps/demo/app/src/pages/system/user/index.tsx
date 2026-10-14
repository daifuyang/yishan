import Taro, { useDidShow } from '@tarojs/taro'

import { Tag } from '@/components/atoms'
import { TabBar } from '@/components/organisms'
import {
  ManagementPage,
  ManagementPageHeader,
  ManagementFilterClear,
  ManagementHeaderAction,
  ManagementList,
  ManagementCell,
  ManagementStates,
  ManagementListFooter,
} from '@/components/management'
import { useListPagination, useCanWrite, confirmAction } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { adminUserApi } from '@/api'
import type { AdminUser } from '@/api/admin/types'
import { PERMS, SYSTEM_PAGES, TAB_PAGES } from '@/constants/routes'

import { withAccountScope } from '@/utils/account-scope'
import {
  buildUserQuery,
  DEFAULT_USER_FILTERS,
  readUserFilters,
  type UserFilters,
} from './filters'
import { UserFilterBar } from './UserFilters'

function userStatus(user: AdminUser): { label: string; variant: 'success' | 'default' | 'warning' } {
  if (user.status === '1') return { label: '启用', variant: 'success' }
  if (user.status === '0') return { label: '禁用', variant: 'default' }
  return { label: '锁定', variant: 'warning' }
}

function UserIndexPage() {
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
    initialFilters: { ...DEFAULT_USER_FILTERS },
    fetcher: async ({ page, pageSize, keyword: kw, filters: fs }) => {
      const query = buildUserQuery(page, pageSize, kw, readUserFilters(fs))
      const { data, pagination } = await adminUserApi.listAdminUsers(query)
      return { list: data, total: pagination.total }
    },
  })

  const userFilters = readUserFilters(filters)
  const filtered = Boolean(keyword || userFilters.status || userFilters.startDate || userFilters.endDate)
  const changeFilters = (patch: Partial<UserFilters>) => {
    setFilters(patch)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const clearFilters = () => {
    setKeyword('')
    changeFilters({ ...DEFAULT_USER_FILTERS })
  }

  useDidShow(() => {
    if (guard.ready && guard.allowed) void refresh()
  })

  if (!guard.ready || !guard.allowed) return <ManagementPage className="page-container">{null}</ManagementPage>

  const handleItemClick = (user: AdminUser) => {
    navigateTo(`/${SYSTEM_PAGES.userDetail}?id=${user.id}`)
  }

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

  const pageAction = canCreate ? (
    <ManagementHeaderAction
      label="新建"
      onClick={() => navigateTo(`/${SYSTEM_PAGES.userEdit}`)}
    />
  ) : undefined

  return (
    <ManagementPage className="page-container"
      bottomActions={process.env.TARO_ENV === 'h5' ? pageAction : undefined}
    >
      <ManagementPageHeader
        title="用户管理"
        action={pageAction}
      />

      <UserFilterBar keyword={keyword} onKeywordChange={setKeyword} filters={userFilters} onChange={changeFilters} />

      {kind === 'empty' && filtered ? (
        <ManagementFilterClear onClick={clearFilters} />
      ) : null}

      <ManagementStates
        kind={kind}
        emptyText={filtered ? '未找到符合条件的用户' : '暂无用户'}
        errorText="加载失败，请重试"
        onRetry={refresh}
      >
        <ManagementList>
          {list.map((u, index) => {
            const displayName = u.realName || u.username || u.phone
            const metadata = [u.username ? `@${u.username}` : '', u.phone || '']
              .filter(Boolean)
              .join(' · ')
            const status = userStatus(u)
            return (
              <ManagementCell
                key={u.id}
                bordered={index < list.length - 1}
                avatar={{ src: u.avatar, name: displayName }}
                title={displayName}
                tag={
                  <Tag size="sm" variant={status.variant}>
                    {status.label}
                  </Tag>
                }
                description={metadata}
                onClick={() => handleItemClick(u)}
                onLongPress={() => void handleLongPress(u)}
              />
            )
          })}
        </ManagementList>
      </ManagementStates>

      <ManagementListFooter
        loadingMore={loadingMore}
        refreshing={refreshing}
        finished={finished}
        empty={list.length === 0}
        summary={list.length ? `共 ${total} 位成员` : undefined}
      />

      <TabBar currentPath={TAB_PAGES.apps} />
    </ManagementPage>
  )
}

export default withAccountScope(UserIndexPage)
