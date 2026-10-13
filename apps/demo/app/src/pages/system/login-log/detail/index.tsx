import { useEffect, useRef, useState } from 'react'
import { useRouter, useDidHide, useDidShow } from '@tarojs/taro'
import { getAdminLoginLog } from '@/api/admin/loginLog'
import type { AdminLoginLog } from '@/api/admin/types'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import { DetailContent, DetailHero, DetailRow, DetailSection, ManagementPage, ManagementPageHeader } from '@/components/management'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { errorMessage, withAccountScope } from '@/utils/account-scope'

function LoginLogDetail() {
  const guard = useRequireAuth({ moduleId: 'system-login-log' })
  const id = Number(useRouter().params.id)
  const [record, setRecord] = useState<AdminLoginLog | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const sequence = useRef(0)
  const refreshOnShow = useRef(false)
  async function load() {
    if (!guard.ready || !guard.allowed) return
    const current = ++sequence.current
    const session = getSessionVersion()
    const active = () => current === sequence.current && session === getSessionVersion()
    setLoading(true); setError('')
    try {
      if (!Number.isInteger(id) || id <= 0) throw new Error('日志 ID 缺失或无效')
      const result = await getAdminLoginLog(id)
      if (active()) setRecord(result)
    } catch (cause) { if (active()) setError(errorMessage(cause)) }
    finally { if (active()) setLoading(false) }
  }
  useEffect(() => { void load(); return () => { sequence.current++ } }, [id, guard.ready, guard.allowed])
  useDidHide(() => { refreshOnShow.current = true; sequence.current++ })
  useDidShow(() => { if (refreshOnShow.current) { refreshOnShow.current = false; void load() } })
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return <ManagementPage>
    {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="登录详情" /> : null}
    <DetailContent><StateView kind={error ? 'error' : loading ? 'loading' : !record ? 'empty' : 'ready'} text={error || undefined} onRetry={load}>
      {record ? <><DetailHero glyph="shield" title={record.status === '1' ? '登录成功' : '登录失败'} subtitle={record.realName || record.username} footnote={formatDateTime(record.createdAt)} />
        <DetailSection title="登录信息"><DetailRow label="账号" value={record.username} /><DetailRow label="姓名" value={record.realName} /><DetailRow label="状态" value={record.status === '1' ? '成功' : '失败'} /><DetailRow label="提示信息" value={record.message} /><DetailRow label="IP地址" value={record.ipAddress} /><DetailRow label="客户端" value={record.userAgent} /></DetailSection>
        <DetailSection title="日志记录" collapsible defaultCollapsed><DetailRow label="日志 ID" value={record.id} /><DetailRow label="用户 ID" value={record.userId} /><DetailRow label="创建时间" value={formatDateTime(record.createdAt)} /><DetailRow label="更新时间" value={formatDateTime(record.updatedAt)} /></DetailSection></> : null}
    </StateView></DetailContent>
  </ManagementPage>
}
export default withAccountScope(LoginLogDetail)

