import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { Button } from '@/components/atoms'
import { ErrorState, LoadingState } from '@/components/feedback'
import { getServerInfo, type ServerInfo } from '@/api/demo'
import { useRequireAuth } from '@/utils/auth-guard'
import { AdminNotice, AdminPage, errorMessage } from '../../system/_shared/AdminUI'
import { useAuthStore } from '@/stores/auth'

export default function HealthPage() {
  const auth = useRequireAuth({ moduleId: 'demo-health' })
  const identity = useAuthStore((state) => state.user?.id)
  return auth.allowed ? <HealthContent key={identity} /> : <AdminPage title="健康检查">{null}</AdminPage>
}

function HealthContent() {
  const auth = useRequireAuth({ moduleId: 'demo-health' })
  const [info, setInfo] = useState<ServerInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const generation = useRef(0)
  const allowed = useRef(auth.allowed)
  allowed.current = auth.allowed
  const load = async () => {
    if (!allowed.current) return
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      const data = await getServerInfo()
      if (current === generation.current && allowed.current) setInfo(data)
    } catch (cause) { if (current === generation.current && allowed.current) setError(errorMessage(cause)) }
    finally { if (current === generation.current) setLoading(false) }
  }
  useEffect(() => { if (auth.allowed) void load(); else setInfo(null); return () => { generation.current++ } }, [auth.allowed])
  usePullDownRefresh(async () => { try { await load() } finally { Taro.stopPullDownRefresh() } })
  const rows = info ? [
    ['模块', info.module], ['运行环境', info.env], ['Node 版本', info.nodeVersion], ['主机', info.hostname], ['平台 / 架构', `${info.platform} / ${info.arch}`],
    ['CPU 核数', String(info.cpus)], ['进程 ID', String(info.pid)], ['运行时长', `${Math.floor(info.uptimeSeconds / 86400)} 天 ${Math.floor(info.uptimeSeconds % 86400 / 3600)} 小时 ${Math.floor(info.uptimeSeconds % 3600 / 60)} 分钟`],
    ['内存总量', `${(info.memory.total / 1024 ** 3).toFixed(2)} GB`], ['可用内存', `${(info.memory.free / 1024 ** 3).toFixed(2)} GB`],
    ['内存使用率', `${(info.memory.total ? Math.max(0, Math.min(100, (1 - info.memory.free / info.memory.total) * 100)) : 0).toFixed(1)}%`], ['服务器时间', info.timestamp],
  ] : []
  return <AdminPage title="健康检查" action={<Button size="sm" disabled={loading} onClick={load}>刷新</Button>}>
    <AdminNotice>查看示例插件的实时运行状态。</AdminNotice>
    {error ? <ErrorState text={error} onRetry={load} /> : null}
    {loading && !info ? <LoadingState /> : null}
    {info ? <View className="admin-card">{rows.map(([label, value]) => <View className="admin-row" key={label}><Text>{label}</Text><Text>{value}</Text></View>)}</View> : null}
  </AdminPage>
}
