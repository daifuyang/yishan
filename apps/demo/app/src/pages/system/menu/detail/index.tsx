import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { getAdminMenu, updateAdminMenu, type AdminMenu } from '@/api/admin/menu'
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
  menuResourceType,
  ManagementPage,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { MENU_TYPE_LABELS, menuCanHaveChildren } from '../filters'
import { removeMenu } from '../model'


function MenuDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-menu' })
  const rawId = useRouter().params.id
  const id = rawId ? Number(rawId) : 0
  const validId = Number.isInteger(id) && id > 0
  const canUpdate = useCanWrite('system:menu:update')
  const canCreate = useCanWrite('system:menu:create')
  const canDelete = useCanWrite('system:menu:delete')
  const [menu, setMenu] = useState<AdminMenu | null>(null)
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
      const data = await getAdminMenu(id)
      if (alive()) setMenu(data)
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
    const permission = deleting ? 'system:menu:delete' : 'system:menu:update'
    if (!menu || locked.current || loading || !canWriteModuleNow('system-menu', [permission]))
      return
    const session = getSessionVersion()
    const alive = () =>
      mounted.current &&
      session === getSessionVersion() &&
      canWriteModuleNow('system-menu', [permission])
    locked.current = true
    setBusy(true)
    setMore(false)
    try {
      if (deleting) {
        if (await removeMenu(menu, alive)) {
          void Taro.showToast({ title: '已删除', icon: 'success' })
          navigateBack(1)
        }
      } else {
        const data = await updateAdminMenu(menu.id, {
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
  const resourceType = menuResourceType(menu?.type ?? 1)
  // 按钮是叶子，挂不了下级；此时底部只有编辑 + 更多两个位置，
  // 启用/禁用低频但可逆，不该为此再藏一层。
  const canCreateChild = Boolean(canCreate && menu && menuCanHaveChildren(menu.type))
  // 底部最多三个：编辑、新建下级、更多；挤到三个时启用/禁用收进「更多」。
  const actions: BottomAction[] = [
    ...(canUpdate
      ? [
          {
            key: 'edit',
            label: '编辑',
            icon: 'pencil' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${SYSTEM_PAGES.menuForm}?id=${id}`),
          },
        ]
      : []),
    ...(canCreateChild
      ? [
          {
            key: 'child',
            label: '新建下级',
            icon: 'plus' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${SYSTEM_PAGES.menuForm}?parentId=${menu?.id}`),
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
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="菜单详情" /> : null}
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
                note={MENU_TYPE_LABELS[menu.type]}
              />
              <DetailSection title="基本信息">
                <DetailRow label="菜单名称" value={menu.name} />
                <DetailRow label="菜单类型" value={MENU_TYPE_LABELS[menu.type]} />
                <DetailRow label="状态" value={menu.status === '1' ? '启用' : '禁用'} />
                <DetailRow label="排序" value={menu.sort_order} />
                <DetailRow label="路由路径" value={menu.path} />
                {menu.type !== 0 ? (
                  <DetailRow label="组件路径" value={menu.component} />
                ) : null}
                <DetailRow label="图标" value={menu.icon} />
                <DetailRow
                  label="下级菜单"
                  value={childCount ? `${childCount} 个` : '无'}
                />
              </DetailSection>
              <DetailSection title="显示设置">
                <DetailRow
                  label="在菜单中隐藏"
                  value={menu.hideInMenu ? '是' : '否'}
                />
                <DetailRow label="缓存页面" value={menu.keepAlive ? '是' : '否'} />
                <DetailRow label="外部链接" value={menu.isExternalLink ? '是' : '否'} />
                {menu.type === 2 ? (
                  <DetailRow
                    label="页面默认访问操作"
                    value={menu.isDefaultAction ? '是' : '否'}
                  />
                ) : null}
              </DetailSection>
              {menu.type !== 0 && menu.permissionCodes?.length ? (
                <DetailSection title={`关联功能（${menu.permissionCodes.length}）`}>
                  {menu.permissionCodes.map((code) => (
                    <DetailRow key={code} label={code} />
                  ))}
                </DetailSection>
              ) : null}
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
          // 删除排在最后：它不可逆，误触代价最高，要离拇指最远
          // 启用/禁用只在底部放不下时才出现在这里
          ...(canUpdate && canCreateChild
            ? [
                {
                  key: 'toggle',
                  label: menu?.status === '1' ? '禁用菜单' : '启用菜单',
                  icon: 'ban' as const,
                  onClick: () => void mutate(false),
                },
              ]
            : []),
          ...(canDelete
            ? [
                {
                  key: 'delete',
                  label: childCount ? '删除菜单（含下级）' : '删除菜单',
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
export default withAccountScope(MenuDetailPage)
