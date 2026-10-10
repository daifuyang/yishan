import { useMemo, useRef, useState } from 'react'

import { useAuthStore } from '@/stores/auth'

import { getVisibleTodoSources, type HomeTodoItem, pickTopTodos } from './home-todos'

export interface HomeTodos {
  /** 是否存在当前用户可访问的真实待办来源；为 false 时首页隐藏整个模块 */
  available: boolean
  listEntry?: string
  items: HomeTodoItem[]
  loaded: boolean
  loading: boolean
  error: string | null
  load: () => Promise<void>
}

export function useHomeTodos(): HomeTodos {
  const permissions = useAuthStore((state) => state.user?.permissions)
  const sources = useMemo(() => getVisibleTodoSources(permissions), [permissions])
  const [items, setItems] = useState<HomeTodoItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef<Promise<void> | null>(null)

  const load = () => {
    if (sources.length === 0) return Promise.resolve()
    if (inFlight.current) return inFlight.current
    setLoading(true)
    setError(null)
    const request = (async () => {
      try {
        const results = await Promise.all(sources.map((source) => source.load()))
        setItems(pickTopTodos(results.flat()))
        setLoaded(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : '待办加载失败')
      } finally {
        inFlight.current = null
        setLoading(false)
      }
    })()
    inFlight.current = request
    return request
  }

  return {
    available: sources.length > 0,
    // 多来源时没有统一列表页，不提供「全部」
    listEntry: sources.length === 1 ? sources[0].listEntry : undefined,
    items,
    loaded,
    loading,
    error,
    load,
  }
}
