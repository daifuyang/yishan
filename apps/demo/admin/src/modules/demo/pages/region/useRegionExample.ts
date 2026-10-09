/**
 * useRegionExample
 *
 * 一组 ProFormRegionCascader 的 state 容器：value + 末级 code + 实时回填路径。
 *
 * 接受 antd Form 实例 + 字段名两个参数（避免 Form.useFormInstance() 在
 * RegionExample 顶层 React 树里拿不到 form context 的问题）。
 *
 * 行为：
 *   - 初始化时若已有 value 则触发 path 查询
 *   - 任一 cascader value 改变时自动调 /api/v1/admin/system/regions/path
 *   - 防过期：cancelled flag + lastQueriedCode 跳过同 code 重复查询
 */
import { Form, type FormInstance } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSystemRegionPath } from '@/services/generated/systemRegions'

type RegionPathNode = { code: number; name: string; level: number }

export interface UseRegionExampleReturn {
  value: (string | number)[]
  leafCode: number | null
  leafName: string
  pathText: string
  pathLoading: boolean
  pathError: string | null
}

export function useRegionExample(
  form: FormInstance,
  fieldName: string,
): UseRegionExampleReturn {
  // 通过 form.useWatch 实时跟随该字段值
  const value = (Form.useWatch(fieldName, form) ?? []) as (string | number)[]

  const [path, setPath] = useState<RegionPathNode[]>([])
  const [pathLoading, setPathLoading] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)

  const leafCode = value.length > 0 ? Number(value[value.length - 1]) : 0
  const hasLeaf = value.length > 0 && Number.isFinite(leafCode) && leafCode > 0
  const lastQueriedCode = useRef(0)

  useEffect(() => {
    if (!hasLeaf) {
      setPath([])
      setPathError(null)
      setPathLoading(false)
      lastQueriedCode.current = 0
      return
    }
    if (lastQueriedCode.current === leafCode) return
    lastQueriedCode.current = leafCode
    let cancelled = false
    setPathLoading(true)
    setPathError(null)
    ;(async () => {
      try {
        const res = await getSystemRegionPath({ code: leafCode })
        if (cancelled) return
        const data = (res as { data?: RegionPathNode[] }).data
        setPath(Array.isArray(data) ? data : [])
      } catch (err) {
        if (cancelled) return
        setPath([])
        setPathError(err instanceof Error ? err.message : '路径查询失败')
      } finally {
        if (!cancelled) setPathLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasLeaf, leafCode])

  const leafName = useMemo(() => {
    const found = path.find((p) => p.code === leafCode)
    if (found) return found.name
    if (!hasLeaf) return '—'
    if (pathError) return '查询失败'
    return '…'
  }, [path, leafCode, hasLeaf, pathError])

  const pathText = useMemo(() => {
    if (path.length > 0) return path.map((p) => p.name).join(' / ')
    if (!hasLeaf) return '—'
    if (pathError) return pathError
    return '查询中…'
  }, [path, hasLeaf, pathError])

  return {
    value,
    leafCode: hasLeaf ? leafCode : null,
    leafName,
    pathText,
    pathLoading,
    pathError,
  }
}
