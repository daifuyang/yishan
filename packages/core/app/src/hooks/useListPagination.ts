import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'

export interface ListPaginationOptions<T> {
  fetcher: (params: {
    page: number
    pageSize: number
    keyword: string
    filters: Record<string, unknown>
  }) => Promise<{ list: T[]; total: number }>
  pageSize?: number
  keywordDebounce?: number
  initialKeyword?: string
  initialFilters?: Record<string, unknown>
  enabled?: boolean
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
  setKeyword: (keyword: string) => void
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
    enabled = true,
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
  const [filters, setFiltersState] = useState(initialFilters)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const keywordRef = useRef(keyword)
  const filtersRef = useRef(filters)
  const pageRef = useRef(0)
  const finishedRef = useRef(false)
  const generation = useRef(0)
  const activeRequest = useRef<number | null>(null)
  const mounted = useRef(true)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(async () => {
    generation.current++
    activeRequest.current = null
    if (debounce.current) clearTimeout(debounce.current)
    pageRef.current = 0
    finishedRef.current = false
    setList([])
    setTotal(0)
    setPage(1)
    setFinished(false)
    setError(null)
    setLoading(false)
    setRefreshing(false)
    setLoadingMore(false)
  }, [])

  const fetchPage = useCallback(
    async (target: number) => {
      if (!enabledRef.current || !mounted.current || activeRequest.current !== null) return
      const requestGeneration = generation.current
      activeRequest.current = requestGeneration
      setLoading(true)
      setRefreshing(target === 1)
      setLoadingMore(target > 1)
      setError(null)
      const current = () =>
        mounted.current && enabledRef.current && generation.current === requestGeneration
      try {
        const result = await fetcherRef.current({
          page: target,
          pageSize,
          keyword: keywordRef.current,
          filters: filtersRef.current,
        })
        if (!current()) return
        pageRef.current = target
        finishedRef.current = target * pageSize >= result.total || result.list.length === 0
        setTotal(result.total)
        setList((previous) => (target === 1 ? result.list : [...previous, ...result.list]))
        setPage(target)
        setFinished(finishedRef.current)
      } catch (cause) {
        if (current()) setError(cause instanceof Error ? cause.message : '加载失败，请重试')
      } finally {
        if (current()) {
          activeRequest.current = null
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
        }
      }
    },
    [pageSize],
  )

  const refresh = useCallback(async () => {
    // Reset invalidates an earlier fetch before starting the new one.
    void reset()
    await fetchPage(1)
  }, [reset, fetchPage])
  const loadMore = useCallback(async () => {
    if (pageRef.current === 0 || finishedRef.current) return
    await fetchPage(pageRef.current + 1)
  }, [fetchPage])
  const setKeyword = useCallback(
    (value: string) => {
      if (keywordRef.current === value) return
      keywordRef.current = value
      void reset()
      setKeywordState(value)
    },
    [reset],
  )
  const setFilters = useCallback(
    (patch: Record<string, unknown>) => {
      const next = { ...filtersRef.current, ...patch }
      if (Object.keys(patch).every((key) => Object.is(filtersRef.current[key], patch[key]))) return
      filtersRef.current = next
      void reset()
      setFiltersState(next)
    },
    [reset],
  )

  const previousQuery = useRef({ keyword, filters })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current++
    }
  }, [])
  useEffect(() => {
    const changed =
      previousQuery.current.keyword !== keyword || previousQuery.current.filters !== filters
    previousQuery.current = { keyword, filters }
    void reset()
    if (enabled) {
      if (changed)
        debounce.current = setTimeout(() => {
          void fetchPage(1)
        }, keywordDebounce)
      else void fetchPage(1)
    }
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
      generation.current++
      activeRequest.current = null
    }
  }, [enabled, keyword, filters, keywordDebounce, reset, fetchPage])

  usePullDownRefresh(async () => {
    try {
      await refresh()
    } finally {
      Taro.stopPullDownRefresh()
    }
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
