import { useDidShow } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'

import { contactsApi } from '@/api'
import { getSessionVersion } from '@/api/client'
import type { SysMenuNode } from '@/api/types'
import {
  flattenTree,
  ManagementList,
  ManagementPage,
  ManagementPageHeader,
  ManagementStates,
  ManagementTreeCell,
  toggleExpanded,
} from '@/components/management'
import { SECONDARY_PAGES } from '@/constants/routes'
import { withAccountScope } from '@/utils/account-scope'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'

function ContactsIndex() {
  const guard = useRequireAuth()
  const [tree, setTree] = useState<SysMenuNode[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 首次挂载的 effect 与 useDidShow 可能并发请求：只认最后一次的结果
  const sequence = useRef(0)
  // 卸载后会话版本已切换时，旧响应不应回写到新页面
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const load = async () => {
    if (!guard.ready || !guard.allowed) return
    const ticket = ++sequence.current
    const live = () =>
      ticket === sequence.current && mounted.current && session === getSessionVersion()
    setLoading(true)
    setError(null)
    try {
      const data = await contactsApi.getDeptTree()
      if (live()) setTree(data || [])
    } catch (e) {
      if (live()) setError((e as Error).message || '加载失败')
    } finally {
      if (live()) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [guard.ready, guard.allowed])
  useDidShow(() => {
    void load()
  })

  const rows = useMemo(() => flattenTree<SysMenuNode>(tree, expanded), [tree, expanded])

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const openDept = (id: number, name: string) =>
    navigateTo(`/${SECONDARY_PAGES.contactsDept}?id=${id}&name=${encodeURIComponent(name)}`)

  return (
    <ManagementPage>
      <ManagementPageHeader title="部门" />
      <ManagementStates
        kind={
          error ? 'error' : loading && !tree.length ? 'loading' : !tree.length ? 'empty' : 'ready'
        }
        errorText={error || undefined}
        emptyText="暂无部门"
        onRetry={() => void load()}
      >
        <ManagementList>
          {rows.map(({ node, depth, hasChildren, expanded: isExpanded }, index) => (
            // 点行进部门、点箭头折叠：ManagementTreeCell 的箭头 stopPropagation，两者互不触发
            <ManagementTreeCell
              key={node.id}
              title={node.name}
              depth={depth}
              hasChildren={hasChildren}
              expanded={isExpanded}
              onToggle={() => setExpanded((prev) => toggleExpanded(prev, node.id))}
              bordered={index < rows.length - 1}
              onClick={() => openDept(node.id, node.name)}
            />
          ))}
        </ManagementList>
      </ManagementStates>
    </ManagementPage>
  )
}

export default withAccountScope(ContactsIndex)
