/**
 * 通用列表分页 hook
 *  - 上拉加载更多：调用 onReachBottom
 *  - 下拉刷新：调用 onPullDownRefresh（Taro 页面需配 enablePullDownRefresh）
 *  - 关键词搜索：setKeyword 后自动重置到第 1 页
 *  - 返回：list / loading / refreshing / loadingMore / finished / error / refresh / loadMore / setKeyword / setFilters
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'

import { ApiError } from '@/api/types'

export interface ListPaginationOptions<T> {
  /** 拉取函数：返回 { list, total }
   *  - 每次 keyword / filters 变化都会触发新请求
   *  - 收到的 keyword / filters 总是最新值（避免闭包陷阱）
   */
  fetcher: (params: {
    page: number
    pageSize: number
    keyword: string
    filters: Record<string, unknown>
  }) => Promise<{ list: T[]; total: number }>
  pageSize?: number
  /** 防抖：搜索关键词变化后等待多少毫秒再请求 */
  keywordDebounce?: number
  /** 初始 keyword */
  initialKeyword?: string
  /** 初始 filters（会被合并到 fetcher 入参） */
  initialFilters?: Record<string, unknown>
}

export interface ListPaginationResult<T> {
  list: T[]
  total: number
  page: number
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  finished: boolean
  error: string | null
  keyword: string
  filters: Record<string, unknown>
  setKeyword: (k: string) => void
  setFilters: (patch: Record<string, unknown>) => void
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  reset: () => Promise<void>
}

export function useListPagination<T>(opts: ListPaginationOptions<T>): ListPaginationResult<T> {
  const {
    fetcher,
    pageSize = 20,
    keywordDebounce = 300,
    initialKeyword = '',
    initialFilters = {},
  } = opts

  const [list, setList] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeywordState] = useState(initialKeyword)
  const [filters, setFiltersState] = useState<Record<string, unknown>>(initialFilters)

  const pageRef = useRef(page)
  pageRef.current = page

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // 把 keyword / filters 放到 ref 中，避免 fetcher 闭包拿到旧值
  const keywordRef = useRef(keyword)
  keywordRef.current = keyword
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const reset = useCallback(async () => {
    setList([])
    setTotal(0)
    setPage(1)
    setFinished(false)
    setError(null)
  }, [])

  const fetchPage = useCallback(
    async (target: number, isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true)
      else setLoadingMore(true)
      setLoading(true)
      setError(null)
      try {
        const { list: rows, total: t } = await fetcherRef.current({
          page: target,
          pageSize,
          keyword: keywordRef.current,
          filters: filtersRef.current,
        })
        setTotal(t)
        setList((prev) => (target === 1 ? rows : [...prev, ...rows]))
        setPage(target)
        if (target * pageSize >= t || rows.length === 0) {
          setFinished(true)
        } else {
          setFinished(false)
        }
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : (e as Error)?.message || '加载失败'
        setError(msg)
        if (isRefresh) {
          Taro.showToast({ title: msg, icon: 'none' })
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [pageSize],
  )

  const refresh = useCallback(async () => {
    await reset()
    await fetchPage(1, true)
  }, [reset, fetchPage])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || finished) return
    await fetchPage(pageRef.current + 1, false)
  }, [loading, loadingMore, refreshing, finished, fetchPage])

  const setKeyword = useCallback(
    (k: string) => {
      setKeywordState(k)
    },
    [],
  )

  const setFilters = useCallback((patch: Record<string, unknown>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }))
  }, [])

  // 初始 / 关键词 / filters 变化 → 重置并刷新
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void refresh()
    }, keywordDebounce)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, filters])

  // 首次挂载触发
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void fetchPage(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  usePullDownRefresh(async () => {
    await refresh()
    Taro.stopPullDownRefresh()
  })

  useReachBottom(() => {
    void loadMore()
  })

  return {
    list,
    total,
    page,
    loading,
    refreshing,
    loadingMore,
    finished,
    error,
    keyword,
    filters,
    setKeyword,
    setFilters,
    refresh,
    loadMore,
    reset,
  }
}
