import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { getAdminPosition, updateAdminPosition, type AdminPosition } from '@/api/admin/position'
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
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { removePosition } from '../model'

function PositionDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-position' })
  const id = Number(useRouter().params.id)
  const canUpdate = useCanWrite('system:position:update')
  const canDelete = useCanWrite('system:position:delete')
  const [position, setPosition] = useState<AdminPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false)
  const mounted = useRef(true)
  const sequence = useRef(0)
  const locked = useRef(false)
  const refreshOnShow = useRef(false)
  async function load() {
    if (!guard.ready || !guard.allowed || locked.current) return
    const current = ++sequence.current
    const session = getSessionVersion()
    const active = () =>
      mounted.current && current === sequence.current && session === getSessionVersion()
    setLoading(true)
    setError('')
    try {
      if (!Number.isInteger(id) || id <= 0) throw new Error('岗位 ID 缺失或无效')
      const data = await getAdminPosition(id)
      if (active()) setPosition(data)
    } catch (cause) {
      if (active()) setError(errorMessage(cause))
    } finally {
      if (active()) setLoading(false)
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
    const permission = deleting ? 'system:position:delete' : 'system:position:update'
    if (
      !position ||
      locked.current ||
      loading ||
      !canWriteModuleNow('system-position', [permission])
    )
      return
    const session = getSessionVersion()
    const active = () =>
      mounted.current &&
      session === getSessionVersion() &&
      canWriteModuleNow('system-position', [permission])
    locked.current = true
    setBusy(true)
    setMore(false)
    try {
      if (deleting) {
        if (await removePosition(position, active)) {
          void Taro.showToast({ title: '已删除', icon: 'success' })
          navigateBack(1)
        }
      } else {
        const data = await updateAdminPosition(position.id, {
          status: position.status === '1' ? '0' : '1',
        })
        if (active()) {
          setPosition(data)
          void Taro.showToast({ title: '操作成功', icon: 'success' })
        }
      }
    } catch (cause) {
      if (active()) void Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const actions: BottomAction[] = [
    ...(canUpdate
      ? [
          {
            key: 'edit',
            label: '编辑',
            icon: 'pencil' as const,
            tone: 'primary' as const,
            onClick: () => navigateTo(`/${SYSTEM_PAGES.positionForm}?id=${id}`),
          },
          {
            key: 'toggle',
            label: position?.status === '1' ? '禁用' : '启用',
            icon: 'ban' as const,
            tone: 'warning' as const,
            onClick: () => void mutate(false),
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
            onClick: () => setMore(true),
          },
        ]
      : []),
  ]
  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="岗位详情" /> : null}
      <DetailContent>
        <StateView
          kind={error ? 'error' : loading && !position ? 'loading' : !position ? 'empty' : 'ready'}
          text={error || undefined}
          onRetry={load}
        >
          {position ? (
            <>
              <DetailHero
                glyph="folder"
                title={position.name}
                tag={
                  <Tag variant={position.status === '1' ? 'success' : 'default'}>
                    {position.status === '1' ? '启用' : '禁用'}
                  </Tag>
                }
              />
              <DetailSection title="基本信息">
                <DetailRow label="岗位名称" value={position.name} />
                <DetailRow label="状态" value={position.status === '1' ? '启用' : '禁用'} />
                <DetailRow label="排序" value={position.sort_order} />
                <DetailRow label="岗位描述" value={position.description} multiline />
              </DetailSection>
              <DetailSection title="岗位记录" collapsible defaultCollapsed>
                <DetailRow label="岗位 ID" value={position.id} />
                <DetailRow label="创建时间" value={formatDateTime(position.createdAt)} />
                <DetailRow label="更新时间" value={formatDateTime(position.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
      {position ? (
        <BottomActionBar actions={actions} disabled={busy || loading || Boolean(error)} />
      ) : null}
      <ActionSheet
        open={more}
        items={[
          {
            key: 'delete',
            label: '删除岗位',
            icon: 'trash',
            danger: true,
            onClick: () => void mutate(true),
          },
        ]}
        onClose={() => setMore(false)}
      />
    </ManagementPage>
  )
}
export default withAccountScope(PositionDetailPage)
