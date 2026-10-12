import { PageContainer } from '@/components/layout'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { getServerInfo, type ServerInfo } from '@/api/demo'
import { getSessionVersion } from '@/api/client'
import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  DetailContent,
  DetailHero,
  DetailRow,
  DetailSection,
  ManagementHeaderAction,
  ManagementPage,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { errorMessage, withAccountScope } from '../../system/_shared/AdminUI'
import { envLabel, formatBytes, formatUptime, memoryUsage, memoryUsed } from './model'

function HealthPage() {
  const guard = useRequireAuth({ moduleId: 'demo-health' })
  const [info, setInfo] = useState<ServerInfo | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mounted = useRef(true)
  const loaded = useRef(false)
  // 只有最后一次请求能写入状态：刷新连点或下拉与按钮并发时，旧响应直接丢弃
  const generation = useRef(0)
  async function load() {
    if (!guard.ready || !guard.allowed) return
    const current = ++generation.current
    const session = getSessionVersion()
    const active = () =>
      mounted.current && current === generation.current && session === getSessionVersion()
    setLoading(true)
    setError('')
    try {
      const data = await getServerInfo()
      if (active()) {
        loaded.current = true
        setInfo(data)
        setFetchedAt(new Date())
      }
    } catch (cause) {
      if (!active()) return
      const message = errorMessage(cause)
      setError(message)
      // 已有数据时保留上一次结果，只用轻提示告知刷新失败
      if (loaded.current) void Taro.showToast({ title: message, icon: 'none' })
    } finally {
      if (active()) setLoading(false)
    }
  }
  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
      generation.current++
    }
  }, [guard.ready, guard.allowed])
  usePullDownRefresh(async () => {
    try {
      await load()
    } finally {
      void Taro.stopPullDownRefresh()
    }
  })
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>
  const env = info ? envLabel(info.env) : null
  return (
    <ManagementPage>
      {/* 小程序端由原生导航栏承载标题，刷新走下拉；H5 自绘顶栏，右上角补一个刷新入口 */}
      {process.env.TARO_ENV === 'h5' ? (
        <PageHeader
          title="健康检查"
          right={
            <ManagementHeaderAction label="刷新" showIcon={false} disabled={loading} onClick={() => void load()} />
          }
        />
      ) : null}
      <DetailContent>
        <StateView
          kind={error && !info ? 'error' : loading && !info ? 'loading' : !info ? 'empty' : 'ready'}
          text={error && !info ? error : undefined}
          onRetry={() => void load()}
        >
          {info && env ? (
            <>
              <DetailHero
                glyph="cloud"
                title={info.module}
                tag={<Tag variant={env.variant}>{env.label}</Tag>}
                subtitle={`已运行 ${formatUptime(info.uptimeSeconds)}`}
              />
              <DetailSection title="运行状态">
                <DetailRow label="运行环境" value={env.label} />
                <DetailRow label="运行时长" value={formatUptime(info.uptimeSeconds)} />
                <DetailRow
                  label="内存使用"
                  value={`${formatBytes(memoryUsed(info.memory))} / ${formatBytes(info.memory.total)}（${memoryUsage(info.memory)}%）`}
                />
                <DetailRow label="可用内存" value={formatBytes(info.memory.free)} />
              </DetailSection>
              <DetailSection title="运行时信息">
                <DetailRow label="Node 版本" value={info.nodeVersion} />
                <DetailRow label="主机名" value={info.hostname} />
                <DetailRow label="平台 / 架构" value={`${info.platform} / ${info.arch}`} />
                <DetailRow label="CPU 核数" value={info.cpus} />
                <DetailRow label="进程 ID" value={info.pid} />
              </DetailSection>
              <DetailSection title="记录" collapsible defaultCollapsed>
                <DetailRow label="服务器时间" value={formatDateTime(info.timestamp)} />
                <DetailRow label="最近刷新" value={formatDateTime(fetchedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
    </ManagementPage>
  )
}

export default withAccountScope(HealthPage)
