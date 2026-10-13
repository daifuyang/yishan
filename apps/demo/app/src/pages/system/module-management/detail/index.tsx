import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { listManagedModules, type ManagedModule, toggleModule } from '@/api/admin/moduleManagement'
import { getSessionVersion } from '@/api/client'
import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  type BottomAction,
  BottomActionBar,
  DetailContent,
  DetailHero,
  DetailRow,
  DetailSection,
  ManagementPage,
  ManagementPageHeader,
} from '@/components/management'
import { confirmAction, useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'

function ModuleDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-module-management' })
  const id = useRouter().params.id || ''
  const canToggle = useCanWrite('system:module-management:toggle')
  const [item, setItem] = useState<ManagedModule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const mounted = useRef(true)
  const locked = useRef(false)
  useEffect(() => {
    mounted.current = true
    let active = true
    const session = getSessionVersion()
    const current = () => active && session === getSessionVersion()
    if (guard.allowed) {
      setLoading(true)
      setError('')
      listManagedModules()
        .then((data) => {
          if (current()) {
            const found = data.items.find((row) => row.id === id)
            if (!found) throw new Error('模块不存在或已卸载')
            setItem(found)
          }
        })
        .catch((reason) => {
          if (current())
            setError(
              reason &&
                typeof reason === 'object' &&
                'httpStatus' in reason &&
                reason.httpStatus === 404
                ? '当前服务器未开放模块管理'
                : errorMessage(reason),
            )
        })
        .finally(() => {
          if (current()) setLoading(false)
        })
    }
    return () => {
      active = false
      mounted.current = false
    }
  }, [id, guard.allowed, revision])
  async function toggle() {
    if (
      !item ||
      loading ||
      locked.current ||
      !canWriteModuleNow('system-module-management', ['system:module-management:toggle'])
    )
      return
    const session = getSessionVersion()
    const active = () =>
      mounted.current &&
      session === getSessionVersion() &&
      canWriteModuleNow('system-module-management', ['system:module-management:toggle'])
    locked.current = true
    setBusy(true)
    try {
      if (
        !(await confirmAction({
          title: item.enabled ? '停用模块' : '启用模块',
          content: `确认${item.enabled ? '停用' : '启用'}「${item.name}」？操作即时生效。`,
        })) ||
        !active()
      )
        return
      await toggleModule(item.id, !item.enabled)
      if (!active()) return
      setRevision((value) => value + 1)
      void Taro.showToast({ title: '操作成功', icon: 'success' })
    } catch (reason) {
      if (active()) void Taro.showToast({ title: errorMessage(reason), icon: 'none' })
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const actions: BottomAction[] = canToggle
    ? [
        {
          key: 'toggle',
          label: item?.enabled ? '停用模块' : '启用模块',
          icon: item?.enabled ? 'ban' : 'check',
          tone: item?.enabled ? 'warning' : 'primary',
          onClick: toggle,
        },
      ]
    : []
  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="模块详情" /> : null}
      <DetailContent>
        <StateView
          kind={error ? 'error' : loading ? 'loading' : item ? 'ready' : 'empty'}
          text={error || undefined}
          onRetry={() => setRevision((value) => value + 1)}
        >
          {item ? (
            <>
              <DetailHero
                glyph="folder"
                title={item.name}
                subtitle={`版本 ${item.version}`}
                tag={
                  <Tag variant={item.enabled ? 'success' : 'default'}>
                    {item.enabled ? '启用' : '停用'}
                  </Tag>
                }
              />
              <DetailSection title="模块信息">
                <DetailRow label="模块名称" value={item.name} />
                <DetailRow label="版本" value={item.version} />
                <DetailRow label="状态" value={item.enabled ? '已启用' : '已停用'} />
                <DetailRow label="挂载状态" value={item.mounted ? '已挂载' : '未挂载'} />
              </DetailSection>
              <DetailSection title="技术信息" collapsible defaultCollapsed>
                <DetailRow label="模块标识" value={item.id} />
                <DetailRow label="路由前缀" value={item.routePrefix} />
                <DetailRow label="数据表前缀" value={item.tablePrefix} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
      {item && !error ? <BottomActionBar actions={actions} disabled={busy || loading} /> : null}
    </ManagementPage>
  )
}
export default withAccountScope(ModuleDetailPage)
