import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getRegionTree, type RegionNode } from '@/api/admin/region'
import { Tag } from '@/components/atoms'
import {
  Breadcrumbs,
  DetailRow,
  DetailSection,
  ManagementCell,
  ManagementFilterBar,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
} from '@/components/management'
import { useRequireAuth } from '@/utils/auth-guard'
import { errorMessage, withAccountScope } from '../_shared/AdminUI'

function RegionPage() {
  const guard = useRequireAuth({ moduleId: 'system-region' })
  const [tree, setTree] = useState<RegionNode[]>([])
  const [path, setPath] = useState<RegionNode[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [limit, setLimit] = useState(50)
  useEffect(() => {
    if (!guard.allowed) return
    let active = true
    setLoading(true)
    setError('')
    getRegionTree()
      .then((data) => {
        if (active) {
          setTree(data)
          setPath([])
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason))
      })
      .finally(() => {
        if (active) {
          setLoading(false)
          void Taro.stopPullDownRefresh()
        }
      })
    return () => {
      active = false
    }
  }, [guard.allowed, revision])
  usePullDownRefresh(() => {
    if (guard.allowed) setRevision((value) => value + 1)
    else void Taro.stopPullDownRefresh()
  })
  useReachBottom(() => setLimit((value) => value + 50))
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const matches: { node: RegionNode; ancestors: RegionNode[] }[] = []
  const search = keyword.trim()
  if (search) {
    const visit = (nodes: RegionNode[], ancestors: RegionNode[]) => {
      for (const node of nodes) {
        if (`${node.name} ${node.code}`.includes(search)) matches.push({ node, ancestors })
        visit(node.children || [], [...ancestors, node])
      }
    }
    visit(tree, [])
  }
  const selected = path[path.length - 1]
  const rows = search
    ? matches
    : (selected ? selected.children || [] : tree).map((node) => ({ node, ancestors: path }))
  const leaf = selected && !selected.children?.length && !search
  const levelName = (level: number) => ['', '省级', '市级', '区县级'][level] || '行政区划'
  const browse = (next: RegionNode[]) => {
    setPath(next)
    setKeyword('')
    setLimit(50)
  }
  return (
    <ManagementPage>
      <ManagementPageHeader title="地区管理" />
      <ManagementFilterBar>
        <ManagementSearchBar
          value={keyword}
          onChange={(value) => {
            setKeyword(value)
            setLimit(50)
          }}
          placeholder="搜索地区名称或代码"
        />
      </ManagementFilterBar>
      <Breadcrumbs
        items={path.map((node) => ({ key: node.code, label: node.name }))}
        onNavigate={(index) => browse(index < 0 ? [] : path.slice(0, index + 1))}
      />
      <ManagementStates
        kind={loading ? 'loading' : error ? 'error' : leaf || rows.length ? 'ready' : 'empty'}
        errorText={error}
        emptyText="没有匹配的地区"
        onRetry={() => setRevision((value) => value + 1)}
      >
        {leaf ? (
          <DetailSection title="区划信息">
            <DetailRow label="地区名称" value={selected.name} />
            <DetailRow label="区划代码" value={selected.code} />
            <DetailRow label="行政层级" value={levelName(selected.level)} />
            <DetailRow
              label="所属地区"
              value={
                path
                  .slice(0, -1)
                  .map((node) => node.name)
                  .join(' / ') || '无'
              }
            />
            <DetailRow label="上级代码" value={selected.parentCode} />
            <DetailRow label="排序" value={selected.sortOrder} />
          </DetailSection>
        ) : (
          <ManagementList>
            {rows.slice(0, limit).map(({ node, ancestors }, index) => {
              const hasChildren = Boolean(node.children?.length)
              return (
                <ManagementCell
                  key={node.code}
                  glyph={hasChildren ? 'folder' : 'square'}
                  glyphColor={hasChildren ? '#1677FF' : '#86909C'}
                  title={node.name}
                  // 描述只承载一条信息；行政层级进右列标签，父子路径只在搜索时显示
                  description={
                    search
                      ? [...ancestors.map((item) => item.name), node.name].join(' / ')
                      : String(node.code)
                  }
                  tag={<Tag size="sm">{levelName(node.level)}</Tag>}
                  // 叶子没有下级可进，箭头是假的导航承诺
                  showArrow={hasChildren}
                  bordered={index < Math.min(rows.length, limit) - 1}
                  onClick={() => browse([...ancestors, node])}
                />
              )
            })}
          </ManagementList>
        )}
      </ManagementStates>
      {!leaf && !loading && !error ? (
        <ManagementListFooter
          finished={limit >= rows.length}
          empty={!rows.length}
          summary={`共 ${rows.length} 个地区`}
        />
      ) : null}
    </ManagementPage>
  )
}
export default withAccountScope(RegionPage)
