import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { type ReactNode, useEffect, useRef, useState } from 'react'
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
  ManagementPage,
  ManagementPageHeader,
  type MenuResourceType,
  MenuTypeIcon,
} from '@/components/management'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage } from '@/utils/account-scope'

/**
 * 菜单详情与工作台菜单详情共用的页面骨架：加载、启停用、删除、底部操作栏、
 * 「更多」弹层和记录分组都在这里。各页面只提供数据接口、文案和中间的业务分组，
 * 保证两个详情页的操作位置、文案和交互完全一致。
 */

export interface MenuDetailNode {
  id: number
  name: string
  status: '0' | '1'
  createdAt: string
  updatedAt: string
  children?: unknown[] | null
}

export interface MenuDetailScaffoldProps<T extends MenuDetailNode> {
  /** 资源名，如「菜单」「工作台菜单」：用于标题和操作文案 */
  noun: string
  moduleId: string
  /** 权限前缀，如 system:menu —— 拼出 :update / :create / :delete */
  permission: string
  formPage: string
  fetch: (id: number) => Promise<T>
  setStatus: (id: number, status: '0' | '1') => Promise<T>
  remove: (menu: T, active: () => boolean) => Promise<boolean>
  /** 能否挂下级；叶子节点底部直接放出启用/禁用 */
  canHaveChildren: (menu: T) => boolean
  resourceType: (menu: T) => MenuResourceType
  typeLabel: (menu: T) => string
  /** 记录分组之前的业务分组 */
  children: (menu: T) => ReactNode
}

export function MenuDetailScaffold<T extends MenuDetailNode>({
  noun,
  moduleId,
  permission,
  formPage,
  fetch,
  setStatus,
  remove,
  canHaveChildren,
  resourceType,
  typeLabel,
  children,
}: MenuDetailScaffoldProps<T>) {
  const guard = useRequireAuth({ moduleId })
  const rawId = useRouter().params.id
  const id = rawId ? Number(rawId) : 0
  const validId = Number.isInteger(id) && id > 0
  const canUpdate = useCanWrite(`${permission}:update`)
  const canCreate = useCanWrite(`${permission}:create`)
  const canDelete = useCanWrite(`${permission}:delete`)
  const [menu, setMenu] = useState<T | null>(null)
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
      const data = await fetch(id)
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
    const required = `${permission}:${deleting ? 'delete' : 'update'}`
    if (!menu || locked.current || loading || !canWriteModuleNow(moduleId, [required])) return
    const session = getSessionVersion()
    const alive = () =>
      mounted.current && session === getSessionVersion() && canWriteModuleNow(moduleId, [required])
    locked.current = true
    setBusy(true)
    setMore(false)
    try {
      if (deleting) {
        if (await remove(menu, alive)) {
          void Taro.showToast({ title: '已删除', icon: 'success' })
          navigateBack(1)
        }
      } else {
        const data = await setStatus(menu.id, menu.status === '1' ? '0' : '1')
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
  const enabled = menu?.status === '1'
  // 叶子挂不了下级；此时底部只有编辑 + 更多两个位置，
  // 启用/禁用低频但可逆，不该为此再藏一层。
  const canCreateChild = Boolean(canCreate && menu && canHaveChildren(menu))
  // 底部最多三个：编辑、新建下级、更多；挤到三个时启用/禁用收进「更多」。
  const actions: BottomAction[] = [
    ...(canUpdate
      ? [
          {
            key: 'edit',
            label: '编辑',
            icon: 'pencil' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${formPage}?id=${id}`),
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
            onClick: () => navigateTo(`/${formPage}?parentId=${menu?.id}`),
          },
        ]
      : []),
    ...(canUpdate && !canCreateChild
      ? [
          {
            key: 'toggle',
            label: enabled ? '禁用' : '启用',
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
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title={`${noun}详情`} /> : null}
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
          text={!validId ? `${noun} ID 缺失或无效` : error || undefined}
          onRetry={validId ? () => void load() : undefined}
        >
          {menu ? (
            <>
              <DetailHero
                icon={<MenuTypeIcon type={resourceType(menu)} size={20} />}
                title={menu.name}
                tag={<Tag variant={enabled ? 'success' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>}
                note={typeLabel(menu)}
              />
              {children(menu)}
              <DetailSection title={`${noun}记录`} collapsible defaultCollapsed>
                <DetailRow label={`${noun} ID`} value={menu.id} />
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
                  label: `${enabled ? '禁用' : '启用'}${noun}`,
                  icon: 'ban' as const,
                  onClick: () => void mutate(false),
                },
              ]
            : []),
          ...(canDelete
            ? [
                {
                  key: 'delete',
                  label: childCount ? `删除${noun}（含下级）` : `删除${noun}`,
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
