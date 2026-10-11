import { withAccountScope } from '../_shared/AdminUI'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { listManagedModules, toggleModule, type ManagedModule } from '@/api/admin/moduleManagement'
import { Button } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import { confirmAction, useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { AdminPage, errorMessage } from '../_shared/AdminUI'

function ModuleManagementPage() {
  const guard = useRequireAuth({ moduleId: 'system-module-management' })
  const isCurrent = useCurrentModuleAccess('system-module-management')
  const canToggle = useCanWrite('system:module-management:toggle')
  const [items, setItems] = useState<ManagedModule[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const locked = useRef(false)
  const access = useRef(false)
  access.current = guard.allowed && canToggle
  useEffect(() => {
    if (!guard.allowed) return
    let active = true
    setLoading(true)
    setError('')
    listManagedModules().then((data) => { if (active) setItems(data.items) })
      .catch((reason) => { if (active) setError(reason && typeof reason === 'object' && 'httpStatus' in reason && reason.httpStatus === 404 ? '当前服务器未开放模块管理' : errorMessage(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [guard.allowed, revision])
  const toggle = async (item: ManagedModule) => {
    if (!access.current || !isCurrent(['system:module-management:toggle']) || locked.current) return
    locked.current = true
    setBusy(item.id)
    try {
      if (!await confirmAction({ title: item.enabled ? '停用模块' : '启用模块', content: `确认${item.enabled ? '停用' : '启用'}「${item.name}」？操作即时生效。` }) || !access.current || !isCurrent(['system:module-management:toggle'])) return
      await toggleModule(item.id, !item.enabled)
      if (!isCurrent(['system:module-management:toggle'])) return
      setRevision((value) => value + 1)
      await Taro.showToast({ title: '操作成功', icon: 'success' })
    } catch (reason) { if (isCurrent()) setError(errorMessage(reason)) }
    finally { locked.current = false; if (isCurrent()) setBusy('') }
  }
  if (!guard.ready || !guard.allowed) return <AdminPage title="模块管理">{null}</AdminPage>
  return <AdminPage title="模块管理">
      {error && <StateView kind="error" text={error} onRetry={() => setRevision(revision + 1)} />}
      {loading ? <StateView kind="loading" /> : !error && items.map((item) => <View key={item.id} className="admin-card">
        <Text className="admin-name">{item.name} · {item.id}</Text>
        <Text className="admin-meta">版本 {item.version} · {item.enabled ? '已启用' : '已停用'} · {item.mounted ? '已挂载' : '未挂载'}</Text>
        <Text className="admin-meta">路由 {item.routePrefix} · 表前缀 {item.tablePrefix}</Text>
        {canToggle && <Button size="sm" loading={busy === item.id} disabled={Boolean(busy)} onClick={() => toggle(item)}>{item.enabled ? '停用' : '启用'}</Button>}
      </View>)}
      {!loading && !items.length && !error && <StateView kind="empty" text="暂无已安装模块" />}
  </AdminPage>
}

export default withAccountScope(ModuleManagementPage)
