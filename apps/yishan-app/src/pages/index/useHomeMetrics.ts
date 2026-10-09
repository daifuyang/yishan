import { useEffect, useMemo, useRef, useState } from 'react'

import { dashboardApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

import { getVisibleMetrics, type HomeMetricDef, type MetricSourceData } from './home-metrics'

/** 与后端 dashboard:stats 的 Redis TTL 对齐，返回首页时不重复打接口 */
const CACHE_MS = 30_000

interface MetricsState {
  ownerId: number | null
  data: MetricSourceData | null
  loading: boolean
  error: string | null
}

const INITIAL: MetricsState = { ownerId: null, data: null, loading: false, error: null }

export interface HomeMetrics {
  defs: HomeMetricDef[]
  data: MetricSourceData | null
  loading: boolean
  error: string | null
  /** 成功（含命中缓存 / 无需请求）resolve true，失败 resolve false */
  load: (options?: { force?: boolean }) => Promise<boolean>
}

export function useHomeMetrics(): HomeMetrics {
  const userId = useAuthStore((state) => state.user?.id ?? null)
  const permissions = useAuthStore((state) => state.user?.permissions)
  const defs = useMemo(() => getVisibleMetrics(permissions), [permissions])
  const needsDashboard = defs.some((def) => def.source === 'dashboardStats')

  const [state, setState] = useState<MetricsState>(INITIAL)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const loadedAt = useRef(0)
  const generation = useRef(0)

  // 账号或权限变化：丢弃旧数据与在途请求，避免串号
  useEffect(() => {
    generation.current += 1
    inFlight.current = null
    loadedAt.current = 0
    setState(INITIAL)
  }, [userId, needsDashboard])

  const load = ({ force = false }: { force?: boolean } = {}) => {
    if (!userId || !needsDashboard) return Promise.resolve(true)
    if (inFlight.current) return inFlight.current
    if (!force && Date.now() - loadedAt.current < CACHE_MS) return Promise.resolve(true)
    const requestGeneration = generation.current
    const isCurrent = () => generation.current === requestGeneration
    setState((prev) => ({ ...prev, loading: true, error: null }))
    const request = (async (): Promise<boolean> => {
      try {
        const dashboardStats = await dashboardApi.getStats()
        if (!isCurrent()) return false
        loadedAt.current = Date.now()
        setState({ ownerId: userId, data: { dashboardStats }, loading: false, error: null })
        return true
      } catch (error) {
        if (!isCurrent()) return false
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '数据加载失败',
        }))
        return false
      } finally {
        if (isCurrent()) inFlight.current = null
      }
    })()
    inFlight.current = request
    return request
  }

  return {
    defs,
    data: state.ownerId === userId ? state.data : null,
    loading: state.loading,
    error: state.error,
    load,
  }
}
