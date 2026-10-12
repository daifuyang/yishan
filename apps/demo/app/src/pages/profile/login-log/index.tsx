import { useEffect, useRef, useState } from 'react'
import { Tag } from '@/components/atoms'
import Taro, { useDidHide, usePullDownRefresh, useReachBottom } from '@tarojs/taro'

import { userApi } from '@/api'
import type { LoginLog } from '@/api/types'
import { BottomActionBar, DetailContent, DetailHero, DetailRow, DetailSection, ManagementCell, ManagementList, ManagementListFooter, ManagementPage, ManagementPageHeader, ManagementStates } from '@/components/management'
import { ErrorState } from '@/components/feedback'


import { useAuthStore } from '@/stores/auth'
import { useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'



const PAGE_SIZE = 10

export default function ProfileLoginLog() {
  const userId = useAuthStore((state) => state.user?.id)
  const token = useAuthStore((state) => state.token)
  const auth = useRequireAuth()
  const [selected, setSelected] = useState<LoginLog | null>(null)
  const [list, setList] = useState<LoginLog[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const generation = useRef(0)
  const retry = useRef({ page: 1, reset: true })

  const load = async (requestedPage: number, reset: boolean) => {
    const session = useAuthStore.getState()
    if (!session.bootstrapped || !session.user || !session.token || loadingRef.current) return
    const ownerId = session.user.id
    const requestToken = session.token
    const requestGeneration = generation.current
    const isCurrent = () => {
      const current = useAuthStore.getState()
      return (
        generation.current === requestGeneration &&
        current.user?.id === ownerId &&
        current.token === requestToken
      )
    }
    loadingRef.current = true
    setLoading(true)
    setError(null)
    retry.current = { page: requestedPage, reset }
    try {
      const items = await userApi.getMyLoginLogs({ page: requestedPage, pageSize: PAGE_SIZE })
      if (!isCurrent()) return
      setList((previous) => (reset ? items : [...previous, ...items]))
      setPage(requestedPage)
      setHasMore(items.length >= PAGE_SIZE)
    } catch (failure) {
      if (isCurrent()) setError(failure instanceof Error ? failure.message : '登录日志加载失败')
    } finally {
      if (isCurrent()) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    generation.current += 1
    loadingRef.current = false
    setSelected(null)
    setList([])
    setError(null)
    setLoading(false)
    setPage(1)
    setHasMore(true)
    if (auth.ready && auth.allowed) void load(1, true)
    return () => {
      generation.current += 1
    }
  }, [auth.ready, auth.allowed, userId, token])

  usePullDownRefresh(() => {
    void load(1, true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (hasMore && !error) void load(page + 1, false)
  })

  useDidHide(() => setSelected(null))
  if (!auth.ready || !auth.allowed) return <ManagementPage>{null}</ManagementPage>
  if (selected) return <ManagementPage withActions>
    <ManagementPageHeader title="登录详情" showBack={process.env.TARO_ENV === 'h5'} onBack={() => setSelected(null)} />
    <DetailContent>
      <DetailHero glyph="shield" title={selected.status === '1' ? '登录成功' : '登录失败'} subtitle={formatDateTime(selected.createdAt)} />
      <DetailSection title="登录信息">
        <DetailRow label="账号" value={selected.username} />
        <DetailRow label="状态" value={selected.status === '1' ? '成功' : '失败'} />
        <DetailRow label="提示信息" value={selected.message} />
        <DetailRow label="IP地址" value={selected.ipAddress} />
        <DetailRow label="客户端" value={selected.userAgent} />
      </DetailSection>
      <DetailSection title="日志记录" collapsible defaultCollapsed>
        <DetailRow label="日志 ID" value={selected.id} />
        <DetailRow label="创建时间" value={formatDateTime(selected.createdAt)} />
        <DetailRow label="更新时间" value={formatDateTime(selected.updatedAt)} />
      </DetailSection>
    </DetailContent>
    <BottomActionBar actions={[{ key: 'back', label: '返回记录', tone: 'primary', onClick: () => setSelected(null) }]} />
  </ManagementPage>
  const kind = loading && !list.length ? 'loading' : error && !list.length ? 'error' : !list.length ? 'empty' : 'ready'
  return <ManagementPage>
    <ManagementPageHeader title="我的登录记录" showBack={process.env.TARO_ENV === 'h5'} />
    <ManagementStates kind={kind} errorText={error || undefined} emptyText="暂无登录记录" onRetry={() => void load(retry.current.page, retry.current.reset)}>
      <ManagementList>{list.map((log, index) => <ManagementCell key={log.id} glyph="shield" title={formatDateTime(log.createdAt)} description={log.ipAddress || '未知IP'} tag={<Tag size="sm" variant={log.status === '1' ? 'success' : 'danger'}>{log.status === '1' ? '成功' : '失败'}</Tag>} bordered={index < list.length - 1} onClick={() => setSelected(log)} />)}</ManagementList>
    </ManagementStates>
    {error && list.length ? <ErrorState text={error} onRetry={() => void load(retry.current.page, retry.current.reset)} /> : null}
    <ManagementListFooter loadingMore={loading} finished={!hasMore} empty={!list.length} summary={list.length ? `已加载 ${list.length} 条记录${hasMore ? '' : ' · 没有更多了'}` : undefined} />
  </ManagementPage>
}
