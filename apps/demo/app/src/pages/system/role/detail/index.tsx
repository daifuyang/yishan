import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import * as adminRoleApi from '@/api/admin/role'
import * as adminAppMenuApi from '@/api/admin/appMenu'
import type { AdminAppMenu } from '@/api/admin/appMenu'
import type { AdminRoleDetail } from '@/api/admin/role'
import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  type ActionSheetItem,
  type BottomAction,
  BottomActionBar,
  DetailContent,
  DetailHero,
  DetailRow,
  DetailSection,
  ManagementPage,
  ManagementPageHeader,
} from '@/components/management'
import { PERMS, SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { withAccountScope } from '@/utils/account-scope'
import {
  DATA_SCOPE_LABELS,
  removeRole,
  roleStatus,
  roleTypeLabel,
  toggleRoleStatus,
} from '../model'
import { appMenuEntrySummary } from '../permissions'

function RoleDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-role' })
  const router = useRouter()
  const id = Number(router.params.id)
  // AND 语义：权限内页要求 update + grant 同时具备，用它决定是否给跳转箭头
  const canUpdate = useCanWrite(PERMS.roleUpdate, PERMS.roleGrant)
  const canDelete = useCanWrite(PERMS.roleDelete)
  const canListAppMenus = useCanWrite(PERMS.appMenuList)

  const [role, setRole] = useState<AdminRoleDetail | null>(null)
  // 工作台树只用来区分入口与分组；拿不到时计数退化为「已配置/未配置」
  const [appMenuGroups, setAppMenuGroups] = useState<AdminAppMenu[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const loadSequence = useRef(0)
  const refreshOnShow = useRef(false)

  const load = async () => {
    if (!guard.ready || !guard.allowed || submittingRef.current) return
    const sequence = ++loadSequence.current
    if (!Number.isInteger(id) || id <= 0) {
      setError('角色 ID 缺失或无效')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [data, groups] = await Promise.all([
        adminRoleApi.getAdminRole(id),
        canListAppMenus
          ? adminAppMenuApi.getAdminAppMenuTree().catch(() => null)
          : Promise.resolve(null),
      ])
      if (sequence === loadSequence.current) {
        setRole(data)
        setAppMenuGroups(groups)
      }
    } catch (e) {
      if (sequence === loadSequence.current) setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }

  useEffect(() => {
    setRole(null)
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
  })

  // 菜单树与权限目录不再在详情页拉取：详情只展示计数，清单由权限内页负责。
  // 工作台树例外：appMenuIds 混有分组 id，只有拿到树才能只数入口。

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const kind = error ? 'error' : loading && !role ? 'loading' : !role ? 'empty' : 'ready'
  const status = role ? roleStatus(role) : null
  const disabled = submitting || loading

  const handleToggle = async () => {
    if (!role || disabled) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const updated = await toggleRoleStatus(role)
      if (updated) setRole(updated)
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!role || disabled) return
    setMoreOpen(false)
    submittingRef.current = true
    setSubmitting(true)
    try {
      if (await removeRole(role)) {
        setRole(null)
        setTimeout(() => navigateBack(1), 600)
      }
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '删除失败', icon: 'none' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const actions: BottomAction[] = [
    ...(canUpdate
      ? [
          {
            key: 'edit',
            label: '编辑',
            icon: 'pencil' as const,
            tone: 'primary' as const,
            onClick: () => role && navigateTo(`/${SYSTEM_PAGES.roleForm}?id=${role.id}`),
          },
          {
            key: 'toggle',
            label: status?.label === '启用' ? '禁用' : '启用',
            icon: (status?.label === '启用' ? 'ban' : 'check') as 'ban' | 'check',
            tone: (status?.label === '启用' ? 'warning' : 'primary') as 'warning' | 'primary',
            onClick: handleToggle,
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            key: 'more',
            label: '更多',
            icon: 'moreVertical' as const,
            tone: 'muted' as const,
            onClick: () => setMoreOpen(true),
          },
        ]
      : []),
  ]

  const sheetItems: ActionSheetItem[] = [
    {
      key: 'permissions',
      label: '功能授权',
      icon: 'lockKeyhole',
      onClick: () => {
        setMoreOpen(false)
        if (role) navigateTo(`/${SYSTEM_PAGES.rolePermissions}?id=${role.id}`)
      },
    },
    ...(canDelete && !role?.isSystemDefault
      ? [
          {
            key: 'delete',
            label: '删除角色',
            icon: 'trash' as const,
            danger: true,
            onClick: handleDelete,
          },
        ]
      : []),
  ]

  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="角色详情" /> : null}
      <DetailContent>
        <StateView
          kind={kind}
          text={error || (kind === 'empty' ? '角色不存在' : undefined)}
          onRetry={load}
          minHeight={300}
        >
          {role ? (
            <>
              <DetailHero
                glyph="shield"
                glyphColor={role.isSystemDefault ? '#1677FF' : '#4E5969'}
                title={role.name}
                tag={status ? <Tag variant={status.variant}>{status.label}</Tag> : undefined}
                note={roleTypeLabel(role)}
              />

              <DetailSection title="基本信息">
                <DetailRow label="角色名称" value={role.name} />
                <DetailRow label="角色类型" value={roleTypeLabel(role)} />
                <DetailRow label="状态" value={status?.label} />
                <DetailRow label="数据权限" value={DATA_SCOPE_LABELS[role.dataScope]} />
                <DetailRow label="描述" value={role.description} multiline />
              </DetailSection>

              <DetailSection title="权限配置">
                {/* 只给计数，具体清单到内页看 —— 内页是带搜索和勾选的完整树，
                    详情页铺一排 chip 既挤又看不全。 */}
                {/* 与 PC「功能授权」页签一致：菜单控制页面入口，操作控制可执行范围 */}
                <DetailRow
                  label="功能授权"
                  value={`${role.menuIds?.length ?? 0} 个菜单，${role.permissionCodes?.length ?? 0} 项操作`}
                  showArrow={canUpdate}
                  onClick={
                    canUpdate
                      ? () => navigateTo(`/${SYSTEM_PAGES.rolePermissions}?id=${role.id}`)
                      : undefined
                  }
                />
                <DetailRow
                  label="App 工作台"
                  value={appMenuEntrySummary(role.appMenuIds, appMenuGroups)}
                  showArrow={canUpdate}
                  onClick={
                    canUpdate
                      ? () => navigateTo(`/${SYSTEM_PAGES.roleWorkbench}?id=${role.id}`)
                      : undefined
                  }
                />
              </DetailSection>

              <DetailSection title="账号记录" collapsible defaultCollapsed>
                <DetailRow label="角色 ID" value={role.id} />
                <DetailRow label="创建人" value={role.creatorName} />
                <DetailRow label="创建时间" value={formatDateTime(role.createdAt)} />
                <DetailRow label="更新人" value={role.updaterName} />
                <DetailRow label="更新时间" value={formatDateTime(role.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>

      <BottomActionBar actions={actions} disabled={disabled} />
      <ActionSheet open={moreOpen} items={sheetItems} onClose={() => setMoreOpen(false)} />
    </ManagementPage>
  )
}

export default withAccountScope(RoleDetailPage)
