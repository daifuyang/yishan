import { Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getRegionTree, type RegionNode } from '@/api/admin/region'
import {
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
import styles from './index.module.scss'

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
      <ManagementPageHeader
        title="地区管理"
        subtitle={search ? `找到 ${rows.length} 个地区` : '省 / 市 / 区县 · 只读'}
      />
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
      <View className={styles.path}>
        <Text onClick={() => browse([])}>全部地区</Text>
        {path.map((node, index) => (
          <Text key={node.code} onClick={() => browse(path.slice(0, index + 1))}>
            {' '}
            / {node.name}
          </Text>
        ))}
      </View>
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
            {rows.slice(0, limit).map(({ node, ancestors }, index) => (
              <ManagementCell
                key={node.code}
                glyph="folder"
                title={node.name}
                description={
                  search
                    ? [...ancestors.map((item) => item.name), String(node.code)].join(' / ')
                    : `${levelName(node.level)} · ${node.code}${node.children?.length ? ` · ${node.children.length} 个下级` : ''}`
                }
                bordered={index < Math.min(rows.length, limit) - 1}
                onClick={() => browse([...ancestors, node])}
              />
            ))}
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
      {!loading && !error && limit < rows.length ? (
        <View className={styles.more} onClick={() => setLimit((value) => value + 50)}>
          加载更多
        </View>
      ) : null}
    </ManagementPage>
  )
}
export default withAccountScope(RegionPage)
