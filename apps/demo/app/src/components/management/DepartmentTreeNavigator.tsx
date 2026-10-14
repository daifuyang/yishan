import { Text, View } from '@tarojs/components'
import type { AdminDept } from '@/api/admin/types'

import { Checkbox } from './Checkbox'
import styles from './DepartmentTreeNavigator.module.scss'
import { LineIcon } from './LineIcon'
import { flattenTree } from './menuTreeLogic'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

/** 与 ManagementTreeCell 一致：每层 14px，超过 4 层不再加，避免深树把标题挤没。 */
const INDENT_PX = 14
const MAX_INDENT_DEPTH = 4
const ROW_PADDING_LEFT = 16

export interface DepartmentTreeNavigatorProps {
  /** 整棵部门树。按 children 递归展平，不再只渲染当前层。 */
  nodes: AdminDept[]
  /** 处于展开态的节点 id。未包含的父节点会藏起全部子孙。 */
  expandedIds: ReadonlySet<number>
  selectedIds: ReadonlySet<number>
  /** 搜索定位后需要高亮的节点 */
  highlightId?: number | null
  readonly?: boolean
  onToggleExpand: (id: number) => void
  onToggle: (id: number) => void
}

/**
 * 可展开的缩进树列表。纯展示，不持有选中态、不发请求。
 * 箭头只负责展开/收起；行与 checkbox 都用于选中，任意层级均可选。
 */
export function DepartmentTreeNavigator({
  nodes,
  expandedIds,
  selectedIds,
  highlightId = null,
  readonly = false,
  onToggleExpand,
  onToggle,
}: DepartmentTreeNavigatorProps) {
  const rows = flattenTree(nodes, expandedIds)
  if (rows.length === 0) {
    return (
      <View className={styles.tree}>
        <Text className={styles.empty}>暂无部门</Text>
      </View>
    )
  }

  return (
    <View className={styles.tree}>
      {rows.map(({ node, depth, hasChildren, expanded }) => {
        const checked = selectedIds.has(node.id)
        const indent = Math.min(depth, MAX_INDENT_DEPTH) * INDENT_PX
        return (
          <View
            key={node.id}
            className={cx(styles.treeRow, node.id === highlightId && styles['treeRow--highlight'])}
            aria-label={`部门-${node.name}`}
            hoverClass={readonly ? undefined : styles['treeRow--hover']}
            style={indent ? { paddingLeft: `${ROW_PADDING_LEFT + indent}px` } : undefined}
            onClick={readonly ? undefined : () => onToggle(node.id)}
          >
            <View
              className={styles.toggle}
              aria-label={hasChildren ? `${expanded ? '收起' : '展开'}-${node.name}` : undefined}
              aria-expanded={hasChildren ? expanded : undefined}
              onClick={
                hasChildren
                  ? (event) => {
                      event.stopPropagation()
                      onToggleExpand(node.id)
                    }
                  : undefined
              }
            >
              {hasChildren ? (
                <LineIcon
                  name={expanded ? 'chevronDown' : 'chevronRight'}
                  size={14}
                  color="var(--color-text-tertiary)"
                />
              ) : null}
            </View>
            <Checkbox
              checked={checked}
              disabled={readonly}
              aria-label={`勾选-${node.name}`}
              onClick={readonly ? undefined : () => onToggle(node.id)}
            />
            <Text className={styles.treeName}>{node.name}</Text>
          </View>
        )
      })}
    </View>
  )
}