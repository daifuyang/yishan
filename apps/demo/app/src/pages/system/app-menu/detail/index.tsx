import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import {
  getAdminAppMenu,
  updateAdminAppMenu,
  type AdminAppMenu,
} from '@/api/admin/appMenu'
import { getSessionVersion } from '@/api/client'
import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  BottomActionBar,
  type BottomAction,
  DetailContent,
  DetailHero,
  DetailRow,
  DetailSection,
  MenuTypeIcon,
  ManagementPage,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { isAppMenuGroup, removeAppMenu } from '../model'

const TYPE_LABELS = { 0: '分组', 1: '应用入口' } as const

function AppMenuDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-app-menu' })
  const rawId = useRouter().params.id
  const id = rawId ? Number(rawId) : 0
  const validId = Number.isInteger(id) && id > 0
  const canUpdate = useCanWrite('system:app-menu:update')
  const canCreate = useCanWrite('system:app-menu:create')
  const canDelete = useCanWrite('system:app-menu:delete')
  const [menu, setMenu] = useState<AdminAppMenu | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false)
  const mounted = useRef(true)
  const sequence = useRef(0)
  const locked = useRef(false)
  const refreshOnShow = useRef(false)

  async function load() {
    if (!guard.ready || !guard.allowed || locked.current || !validId) return
    const current = ++sequence.current
    const session = getSessionVersion()
    const alive = () =>
      mounted.current && current === sequence.current && session === getSessionVersion()
    setLoading(true)
    setError('')
    try {
      setMenu(await getAdminAppMenu(id))
    } catch (cause) {
      if (alive()) setError(errorMessage(cause))
    } finally {
      if (alive()) setLoading(false)
    }
  }
  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
      sequence.current++
    }
  }, [id, guard.ready, guard.allowed])
  useDidHide(() => {
    refreshOnShow.current = true
    setMore(false)
  })
  useDidShow(() => {
    if (refreshOnShow.current) {
      refreshOnShow.current = false
      void load()
    }
  })

  async function mutate(deleting: boolean) {
    const permission = deleting ? 'system:app-menu:delete' : 'system:app-menu:update'
    if (!menu || locked.current || loading || !canWriteModuleNow('system-app-menu', [permission]))
      return
    const session = getSessionVersion()
    const alive = () =>
      mounted.current &&
      session === getSessionVersion() &&
      canWriteModuleNow('system-app-menu', [permission])
    locked.current = true
    setBusy(true)
    setMore(false)
    try {
      if (deleting) {
        if (await removeAppMenu(menu, alive)) {
          void Taro.showToast({ title: '已删除', icon: 'success' })
          navigateBack(1)
        }
      } else {
        const data = await updateAdminAppMenu(menu.id, {
          status: menu.status === '1' ? '0' : '1',
        })
        if (alive()) {
          setMenu(data)
          void Taro.showToast({ title: '操作成功', icon: 'success' })
        }
      }
    } catch (cause) {
      if (alive()) void Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    } finally {
      locked.current = false
      if (alive()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const childCount = menu?.children?.length ?? 0
  // 只有分组能容纳入口；入口是叶子，此时底部只有编辑 + 更多两个位置，
  // 启用/禁用就直接放出来，不为它再藏一层。
  const canCreateChild = Boolean(canCreate && menu && isAppMenuGroup(menu))
  // 图标与列表页共用同一套资源类型图标，入口沿用「页面」语义
  const resourceType = isAppMenuGroup(menu ?? ({ type: 1 } as AdminAppMenu)) ? 'directory' : 'page'
  const actions: BottomAction[] = [
    ...(canUpdate
      ? [
          {
            key: 'edit',
            label: '编辑',
            icon: 'pencil' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${SYSTEM_PAGES.appMenuForm}?id=${id}`),
          },
        ]
      : []),
    ...(canCreateChild
      ? [
          {
            key: 'child',
            label: '新建入口',
            icon: 'plus' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${SYSTEM_PAGES.appMenuForm}?parentId=${menu?.id}`),
          },
        ]
      : []),
    ...(canUpdate && !canCreateChild
      ? [
          {
            key: 'toggle',
            label: menu?.status === '1' ? '禁用' : '启用',
            icon: 'ban' as const,
            tone: 'warning' as const,
            onClick: () => void mutate(false),
          },
        ]
      : []),
    ...((canUpdate || canDelete)
      ? [
          {
            key: 'more',
            label: '更多',
            icon: 'moreVertical' as const,
            tone: 'muted' as const,
            onClick: () => setMore(true),
          },
        ]
      : []),
  ]
  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="工作台菜单详情" /> : null}
      <DetailContent>
        <StateView
          kind={
            error
              ? 'error'
              : loading && !menu
                ? 'loading'
                : !menu
                  ? validId
                    ? 'empty'
                    : 'error'
                  : 'ready'
          }
          text={!validId ? '菜单 ID 缺失或无效' : error || undefined}
          onRetry={validId ? () => void load() : undefined}
        >
          {menu ? (
            <>
              <DetailHero
                icon={<MenuTypeIcon type={resourceType} size={20} />}
                title={menu.name}
                tag={
                  <Tag variant={menu.status === '1' ? 'success' : 'default'}>
                    {menu.status === '1' ? '启用' : '禁用'}
                  </Tag>
                }
                note={TYPE_LABELS[menu.type]}
              />
              <DetailSection title="基本信息">
                <DetailRow label="名称" value={menu.name} />
                <DetailRow label="类型" value={TYPE_LABELS[menu.type]} />
                <DetailRow label="状态" value={menu.status === '1' ? '启用' : '禁用'} />
                <DetailRow label="排序" value={menu.sortOrder} />
                <DetailRow label="图标名" value={menu.icon} />
                {!isAppMenuGroup(menu) ? (
                  <>
                    <DetailRow label="页面路径" value={menu.page} />
                    <DetailRow label="所属模块" value={menu.moduleId} />
                  </>
                ) : null}
                {isAppMenuGroup(menu) ? (
                  <DetailRow label="下级入口" value={childCount ? `${childCount} 个` : '无'} />
                ) : null}
              </DetailSection>
              <DetailSection title="菜单记录" collapsible defaultCollapsed>
                <DetailRow label="菜单 ID" value={menu.id} />
                <DetailRow label="创建时间" value={formatDateTime(menu.createdAt)} />
                <DetailRow label="更新时间" value={formatDateTime(menu.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
      {menu ? (
        <BottomActionBar actions={actions} disabled={busy || loading || Boolean(error)} />
      ) : null}
      <ActionSheet
        open={more}
        items={[
          // 删除排在最后：不可逆，误触代价最高
          ...(canUpdate && canCreateChild
            ? [
                {
                  key: 'toggle',
                  label: menu?.status === '1' ? '禁用' : '启用',
                  icon: 'ban' as const,
                  onClick: () => void mutate(false),
                },
              ]
            : []),
          ...(canDelete
            ? [
                {
                  key: 'delete',
                  label: childCount ? '删除分组（含下级入口）' : '删除工作台菜单',
                  icon: 'trash' as const,
                  danger: true,
                  onClick: () => void mutate(true),
                },
              ]
            : []),
        ]}
        onClose={() => setMore(false)}
      />
    </ManagementPage>
  )
}
export default withAccountScope(AppMenuDetailPage)
