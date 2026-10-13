import { useRouter } from '@tarojs/taro'
import { StateView } from '@/components/feedback'
import { DetailContent, DetailHero, DetailRow, DetailSection, ManagementPage, ManagementPageHeader } from '@/components/management'
import { useAuthStore } from '@/stores/auth'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { recallLoginLog } from '../handoff'

export default function ProfileLoginLogDetail() {
  const auth = useRequireAuth()
  const userId = useAuthStore((state) => state.user?.id)
  const id = Number(useRouter().params.id)
  if (!auth.ready || !auth.allowed) return <ManagementPage>{null}</ManagementPage>
  const record = Number.isInteger(id) && id > 0 ? recallLoginLog(userId, id) : null
  return <ManagementPage>
    <ManagementPageHeader title="登录详情" showBack={process.env.TARO_ENV === 'h5'} />
    <DetailContent><StateView kind={record ? 'ready' : 'empty'} text={record ? undefined : '记录已失效'} hint={record ? undefined : '请返回登录日志重新查看'}>
      {record ? <><DetailHero glyph="shield" title={record.status === '1' ? '登录成功' : '登录失败'} subtitle={formatDateTime(record.createdAt)} />
        <DetailSection title="登录信息"><DetailRow label="账号" value={record.username} /><DetailRow label="状态" value={record.status === '1' ? '成功' : '失败'} /><DetailRow label="提示信息" value={record.message} /><DetailRow label="IP地址" value={record.ipAddress} /><DetailRow label="客户端" value={record.userAgent} /></DetailSection>
        <DetailSection title="日志记录" collapsible defaultCollapsed><DetailRow label="日志 ID" value={record.id} /><DetailRow label="创建时间" value={formatDateTime(record.createdAt)} /><DetailRow label="更新时间" value={formatDateTime(record.updatedAt)} /></DetailSection></> : null}
    </StateView></DetailContent>
  </ManagementPage>
}
