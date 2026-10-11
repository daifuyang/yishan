import { Text, View } from '@tarojs/components'
import type { AdminDept } from '@/api/admin/types'

import styles from './DepartmentTreeNavigator.module.scss'
import { type DeptPathNode, hasChildren } from './deptTree'
import { LineIcon } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface DepartmentTreeNavigatorProps {
  /** 当前层的子节点 */
  nodes: AdminDept[]
  /** 从根到当前节点的路径 */
  path: DeptPathNode[]
  selectedIds: ReadonlySet<number>
  /** 搜索跳转后需要高亮的节点 */
  highlightId?: number | null
  readonly?: boolean
  onEnter: (node: AdminDept) => void
  onToggle: (id: number) => void
  onCrumb: (index: number) => void
}

/**
 * 层级导航：面包屑 + 当前层子节点列表。纯展示，不持有选中态、不发请求。
 * 行点击进入下一层，checkbox 独立可点用于选中（任意层级均可选）。
 */
export function DepartmentTreeNavigator({
  nodes,
  path,
  selectedIds,
  highlightId = null,
  readonly = false,
  onEnter,
  onToggle,
  onCrumb,
}: DepartmentTreeNavigatorProps) {
  return (
    <View className={styles.tree}>
      <View className={styles.crumbs}>
        {path.map((crumb, index) => (
          <View
            key={crumb.id}
            className={styles.crumb}
            aria-label={`面包屑-${crumb.name}`}
            onClick={() => onCrumb(index)}
          >
            <Text className={index === path.length - 1 ? styles['crumb--current'] : styles.crumb}>
              {crumb.name}
            </Text>
            {index < path.length - 1 ? (
              <LineIcon name="chevronRight" size={12} color="#C9CDD4" />
            ) : null}
          </View>
        ))}
      </View>

      {nodes.length === 0 ? (
        <Text className={styles.empty}>没有下级部门</Text>
      ) : (
        nodes.map((node) => {
          const branch = hasChildren(node)
          const checked = selectedIds.has(node.id)
          return (
            <View
              key={node.id}
              className={cx(styles.treeRow, node.id === highlightId && styles['treeRow--highlight'])}
              aria-label={`部门-${node.name}`}
              hoverClass={styles['treeRow--hover']}
              onClick={
                branch
                  ? () => onEnter(node)
                  : readonly
                    ? undefined
                    : () => onToggle(node.id)
              }
            >
              {/* checkbox 独立可点：任意层级均可被选中；stopPropagation 避免连带触发行点击 */}
              <View
                className={cx(styles.checkbox, checked && styles['checkbox--on'])}
                aria-label={`勾选-${node.name}`}
                aria-checked={readonly ? undefined : checked}
                onClick={
                  readonly
                    ? undefined
                    : (event) => {
                        event.stopPropagation()
                        onToggle(node.id)
                      }
                }
              >
                {checked ? <LineIcon name="check" size={12} color="#FFFFFF" /> : null}
              </View>
              <Text className={styles.treeName}>{node.name}</Text>
              {branch ? <LineIcon name="chevronRight" size={16} color="#C9CDD4" /> : null}
            </View>
          )
        })
      )}
    </View>
  )
}