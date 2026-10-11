import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { Button } from '@/components/atoms'
import { ErrorState, LoadingState } from '@/components/feedback'
import { getRegionPath, getRegionTree, listRegions, type DemoRegion } from '@/api/demo'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { AdminNotice, AdminPage, AdminSelect, errorMessage } from '../../system/_shared/AdminUI'
import { useAuthStore } from '@/stores/auth'

const LEVEL_NAMES = ['省份', '城市', '区县']

function RegionSelector({ fullTree, enabled }: { fullTree: boolean; enabled: boolean }) {
  const [tree, setTree] = useState<DemoRegion[]>([])
  const [levels, setLevels] = useState<DemoRegion[][]>([[], [], []])
  const [selection, setSelection] = useState<DemoRegion[]>([])
  const [path, setPath] = useState<DemoRegion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const mounted = useRef(true)
  const canPath = useCanWrite('region:path')
  const initialize = async () => {
    if (!enabled) return
    const current = ++generation.current
    setLoading(true)
    setError('')
    setSelection([])
    setPath([])
    try {
      const roots = fullTree ? await getRegionTree() : await listRegions()
      if (current !== generation.current || !mounted.current) return
      setTree(roots)
      setLevels([roots, [], []])
    } catch (cause) { if (current === generation.current && mounted.current) setError(errorMessage(cause)) }
    finally { if (current === generation.current && mounted.current) setLoading(false) }
  }
  useEffect(() => { mounted.current = true; if (enabled) void initialize(); return () => { mounted.current = false; generation.current++ } }, [enabled, fullTree])
  const choose = async (level: number, code: string) => {
    if (!enabled) return
    const current = ++generation.current
    const node = levels[level].find((region) => String(region.code) === code)
    const next = node ? [...selection.slice(0, level), node] : selection.slice(0, level)
    setSelection(next)
    setPath([])
    setError('')
    setLevels((previous) => previous.map((items, index) => index > level ? [] : items))
    if (!node) { setLoading(false); return }
    setLoading(true)
    try {
      if (level < 2) {
        let children: DemoRegion[]
        if (fullTree) {
          let branch = tree
          for (const selected of next) branch = branch.find((region) => region.code === selected.code)?.children ?? []
          children = branch
        } else children = await listRegions(node.code)
        if (current !== generation.current || !mounted.current) return
        setLevels((previous) => previous.map((items, index) => index === level + 1 ? children : items))
      }
      if (canPath) {
        const result = await getRegionPath(node.code)
        if (current === generation.current && mounted.current) setPath(result)
      }
    } catch (cause) { if (current === generation.current && mounted.current) setError(errorMessage(cause)) }
    finally { if (current === generation.current && mounted.current) setLoading(false) }
  }
  return <View className="admin-card">
    <Text className="admin-name">{fullTree ? '整树选择' : '按需加载选择'}</Text>
    <AdminNotice>{fullTree ? '一次加载地区树，选择时在本地展开。' : '选择上级后再加载下级地区。'}</AdminNotice>
    {levels.map((items, index) => index === 0 || selection.length >= index ? <AdminSelect key={LEVEL_NAMES[index]} label={LEVEL_NAMES[index]} value={String(selection[index]?.code ?? '')} disabled={loading || !enabled || items.length === 0} options={[{ label: items.length ? '请选择' : '无下级地区', value: '' }, ...items.map((node) => ({ label: node.name, value: String(node.code) }))]} onChange={(code) => void choose(index, code)} /> : null)}
    {loading ? <LoadingState /> : null}
    {error ? <ErrorState text={error} onRetry={() => selection.length ? choose(selection.length - 1, String(selection[selection.length - 1].code)) : initialize()} /> : null}
    <AdminNotice>已选地区：{selection.map((node) => node.name).join(' / ') || '未选择'}<Text className="admin-meta">末级代码：{selection[selection.length - 1]?.code ?? '—'}</Text>{canPath ? <Text className="admin-meta">服务端路径：{path.map((node) => node.name).join(' / ') || '—'}</Text> : null}</AdminNotice>
    <Button variant="secondary" disabled={loading} onClick={initialize}>重置</Button>
  </View>
}

export default function RegionExamplePage() {
  const guard = useRequireAuth({ moduleId: 'demo-region' })
  const canList = useCanWrite('region:list')
  const canTree = useCanWrite('region:tree')
  const identity = useAuthStore((state) => state.user?.id)
  return <AdminPage title="省市级联">
    {guard.allowed && canList ? <RegionSelector key={`${identity}:lazy`} fullTree={false} enabled={guard.allowed} /> : null}
    {guard.allowed && canTree ? <RegionSelector key={`${identity}:tree`} fullTree enabled={guard.allowed} /> : <AdminNotice>整树选择需要地区树查看权限。</AdminNotice>}
  </AdminPage>
}
