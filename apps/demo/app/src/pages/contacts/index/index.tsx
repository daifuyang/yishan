import { useEffect, useMemo, useState } from 'react'

import { contactsApi } from '@/api'
import type { SysMenuNode } from '@/api/types'
import {
  ManagementList,
  ManagementPage,
  ManagementPageHeader,
  ManagementStates,
  ManagementTreeCell,
} from '@/components/management'
import { SECONDARY_PAGES } from '@/constants/routes'
import { useRequireAuth } from '@/utils/auth-guard'
import { withAccountScope } from '@/utils/account-scope'
import { navigateTo } from '@/utils/router'

function hasChildren(node: SysMenuNode): boolean {
  return Array.isArray(node.children) && node.children.length > 0
}

function ContactsIndex() {
  const guard = useRequireAuth()
  const [tree, setTree] = useState<SysMenuNode[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!guard.ready || !guard.allowed) return
    setLoading(true)
    setError(null)
    try {
      const data = await contactsApi.getDeptTree()
      setTree(data || [])
    } catch (e) {
      setError((e as Error).message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 首次挂载走 useEffect。账号切换由 withAccountScope 的 key 触发整页重挂载，
  // 此处不需要单独监听 user.id；下拉刷新由调用方显式触发。
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.ready, guard.allowed])

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const rows = useMemo(() => {
    const out: { node: SysMenuNode; depth: number }[] = []
    const walk = (nodes: SysMenuNode[], depth: number) => {
      for (const node of nodes) {
        out.push({ node, depth })
        if (expanded.has(node.id)) walk(node.children ?? [], depth + 1)
      }
    }
    walk(tree, 0)
    return out
  }, [tree, expanded])

  const toggle = (id: number) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const openDept = (id: number, name: string) =>
    navigateTo(`/${SECONDARY_PAGES.contactsDept}?id=${id}&name=${encodeURIComponent(name)}`)

  return (
    <ManagementPage>
      <ManagementPageHeader title="部门" />
      <ManagementStates
        kind={
          error
            ? 'error'
            : loading && !tree.length
              ? 'loading'
              : !tree.length
                ? 'empty'
                : 'ready'
        }
        errorText={error || undefined}
        emptyText="暂无部门"
        onRetry={() => void load()}
      >
        <ManagementList>
          {rows.map(({ node, depth }, index) => (
            // 点行进部门、点箭头折叠：ManagementTreeCell 的箭头 stopPropagation，两者互不触发
            <ManagementTreeCell
              key={node.id}
              title={node.name}
              depth={depth}
              hasChildren={hasChildren(node)}
              expanded={expanded.has(node.id)}
              onToggle={() => toggle(node.id)}
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
