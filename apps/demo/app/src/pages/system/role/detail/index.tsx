import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as adminRoleApi from '@/api/admin/role'
import * as adminMenuApi from '@/api/admin/menu'
import type { AdminRoleDetail } from '@/api/admin/role'
import type { AdminPermission } from '@/api/admin/menu'
import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  type ActionSheetItem,
  type BottomAction,
  BottomActionBar,
  DetailContent,
  DetailGroupList,
  DetailHero,
  DetailRow,
  DetailSection,
  ManagementPage,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { PERMS, SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { withAccountScope } from '../../_shared/AdminUI'
import {
  DATA_SCOPE_LABELS,
  removeRole,
  roleStatus,
  roleTypeLabel,
  toggleRoleStatus,
} from '../model'
import { groupMenuPermissions, groupPermissionCodes, type PermissionGroup } from '../permissions'

function RoleDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-role' })
  const router = useRouter()
  const id = Number(router.params.id)
  const canUpdate = useCanWrite(PERMS.roleUpdate, PERMS.roleGrant)
  const canDelete = useCanWrite(PERMS.roleDelete)

  const [role, setRole] = useState<AdminRoleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuGroups, setMenuGroups] = useState<PermissionGroup[]>([])
  const [catalog, setCatalog] = useState<AdminPermission[]>([])
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
      const data = await adminRoleApi.getAdminRole(id)
      if (sequence === loadSequence.current) setRole(data)
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

  // 菜单树与权限目录用于把 ID 还原成可读名称；缺少读取权限时静默降级。
  const menuIdsKey = role?.menuIds?.join(',') ?? ''
  const codesKey = role?.permissionCodes?.join(',') ?? ''
  const currentMenuIds = useMemo(
    () => (menuIdsKey ? menuIdsKey.split(',').map(Number) : undefined),
    [menuIdsKey],
  )
  useEffect(() => {
    if (!guard.allowed) return
    let active = true
    void (async () => {
      try {
        const menus = await adminMenuApi.getAdminMenuTree()
        if (active) setMenuGroups(groupMenuPermissions(currentMenuIds, menus ?? []))
      } catch {
        if (active) setMenuGroups([])
      }
      try {
        const list = await adminMenuApi.getAdminPermissionCatalog()
        if (active) setCatalog(list ?? [])
      } catch {
        if (active) setCatalog([])
      }
    })()
    return () => {
      active = false
    }
  }, [menuIdsKey, codesKey, guard.allowed])

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const kind = error ? 'error' : loading && !role ? 'loading' : !role ? 'empty' : 'ready'
  const status = role ? roleStatus(role) : null
  const permissionGroups = role ? groupPermissionCodes(role.permissionCodes, catalog) : []
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
            label: '更多操作',
            icon: 'ellipsis' as const,
            tone: 'muted' as const,
            onClick: () => setMoreOpen(true),
          },
        ]
      : []),
  ]

  const sheetItems: ActionSheetItem[] = [
    {
      key: 'permissions',
      label: '配置权限',
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
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="角色详情" /> : null}
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
                subtitle={role.description || '暂无描述'}
              />

              <DetailSection title="基本信息">
                <DetailRow label="角色名称" value={role.name} />
                <DetailRow label="角色类型" value={roleTypeLabel(role)} />
                <DetailRow label="状态" value={status?.label} />
                <DetailRow label="数据权限" value={DATA_SCOPE_LABELS[role.dataScope]} />
                <DetailRow label="描述" value={role.description} />
              </DetailSection>

              <DetailSection title="菜单权限">
                <DetailGroupList groups={menuGroups} />
              </DetailSection>

              {permissionGroups.length > 0 ? (
                <DetailSection title="功能权限">
                  <DetailGroupList groups={permissionGroups} />
                </DetailSection>
              ) : null}

              <DetailSection title="账号记录">
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
