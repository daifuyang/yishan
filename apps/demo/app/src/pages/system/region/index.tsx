import { withAccountScope } from '../_shared/AdminUI'
import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { getRegionTree, type RegionNode } from '@/api/admin/region'
import { FormField } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { useRequireAuth } from '@/utils/auth-guard'
import { AdminNotice, AdminPage, errorMessage } from '../_shared/AdminUI'

function RegionPage() {
  const guard = useRequireAuth({ moduleId: 'system-region' })
  const [tree, setTree] = useState<RegionNode[]>([])
  const [path, setPath] = useState<RegionNode[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!guard.allowed) return
    let active = true
    setLoading(true)
    setError('')
    getRegionTree().then((data) => { if (active) setTree(data) })
      .catch((reason) => { if (active) setError(errorMessage(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [guard.allowed, revision])
  if (!guard.ready || !guard.allowed) return <AdminPage title="地区管理">{null}</AdminPage>
  const rows = path.length ? path[path.length - 1].children || [] : tree
  const matches: { node: RegionNode; ancestors: RegionNode[] }[] = []
  if (keyword.trim()) {
    const visit = (nodes: RegionNode[], ancestors: RegionNode[]) => {
      for (const node of nodes) {
        if (`${node.name} ${node.code}`.includes(keyword.trim())) matches.push({ node, ancestors })
        visit(node.children || [], [...ancestors, node])
      }
    }
    visit(tree, [])
  }
  const visible = keyword.trim() ? matches : rows.map((node) => ({ node, ancestors: path }))
  return <AdminPage title="地区管理">
    <FormField type="input" label="搜索地区名称或代码" value={keyword} onInput={setKeyword} />
    <AdminNotice>行政区划数据只读，可浏览省、市、区县。</AdminNotice>
    {loading ? <StateView kind="loading" /> : error ? <StateView kind="error" text={error} onRetry={() => setRevision(revision + 1)} /> : <>
      <View className="admin-actions"><Text onClick={() => { setPath([]); setKeyword('') }}>全部地区</Text>{path.map((node, index) => <Text key={node.code} onClick={() => { setPath(path.slice(0, index + 1)); setKeyword('') }}> / {node.name}</Text>)}</View>
      {visible.slice(0, 100).map(({ node, ancestors }) => <View key={node.code} className="admin-card" onClick={() => { setPath([...ancestors, node]); setKeyword('') }}>
        <Text className="admin-name">{node.name}{node.children?.length ? ' ›' : ''}</Text>
        <Text className="admin-meta">代码 {node.code} · {['', '省', '市', '区县'][node.level]} · 上级 {node.parentCode} · 排序 {node.sortOrder}</Text>
        {keyword && <Text className="admin-meta">{ancestors.map((item) => item.name).join(' / ')}</Text>}
      </View>)}
      {visible.length > 100 && <AdminNotice>匹配 {visible.length} 条，请缩小搜索范围。</AdminNotice>}
      {!visible.length && <StateView kind="empty" text={path.length && !keyword ? '该地区没有下级区划' : '没有匹配的地区'} />}
    </>}
  </AdminPage>
}

export default withAccountScope(RegionPage)
