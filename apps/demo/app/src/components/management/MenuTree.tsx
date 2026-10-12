import { Text, View } from '@tarojs/components'
import type { ReactNode } from 'react'

import { LineIcon } from './LineIcon'
import styles from './MenuTree.module.scss'
import { flattenTree, type TreeNode } from './menuTreeLogic'
import {
  MENU_RESOURCE_COLORS,
  MENU_RESOURCE_ICONS,
  MENU_RESOURCE_LABELS,
  type MenuResourceType,
} from './menuResourceTypes'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export {
  MENU_RESOURCE_COLORS,
  MENU_RESOURCE_ICONS,
  MENU_RESOURCE_LABELS,
  type MenuResourceType,
  menuResourceType,
  menuTypeLabel,
} from './menuResourceTypes'

export interface MenuTypeIconProps {
  type: MenuResourceType
  size?: number
  color?: string
}

/**
 * 菜单资源图标。列表页、详情页顶部、表单类型选择器全部复用这一个组件 ——
 * 各页面各画各的，最后一定会长出两套不一致的图标语言。
 */
export function MenuTypeIcon({ type, size = 16, color }: MenuTypeIconProps) {
  return (
    <LineIcon
      name={MENU_RESOURCE_ICONS[type]}
      size={size}
      color={color ?? MENU_RESOURCE_COLORS[type]}
    />
  )
}

/** 兼容旧名：语义类型已由 MenuTypeIcon / MenuTypeBadge 承担。 */
export const MenuNodeIcon = MenuTypeIcon

export interface MenuTypeBadgeProps {
  type: MenuResourceType
}

/** 类型标签：浅底色小圆角，不抢标题的视觉重量。 */
export function MenuTypeBadge({ type }: MenuTypeBadgeProps) {
  const cls =
    type === 'directory' ? 'badge--directory' : type === 'page' ? 'badge--page' : 'badge--action'
  return <Text className={cx(styles.badge, styles[cls])}>{MENU_RESOURCE_LABELS[type]}</Text>
}

export interface MenuModuleHeaderProps {
  title: ReactNode
  /** 模块下的可见节点数，让用户没展开也知道里面有多少东西 */
  count: number
  expanded: boolean
  /** 只切换展开，与「进入模块」是两个意图 */
  onToggle: () => void
  /** 进入模块详情 */
  onClick?: () => void
}

/**
 * 一级模块头：整块可点进详情，左侧箭头单独负责展开/收起。
 *
 * 路由在这一层不显示 —— 模块是「去哪一块」的分组，不是具体页面，
 * 把它和页面路由混排会让人以为模块本身也是一个页面。
 */
export function MenuModuleHeader({
  title,
  count,
  expanded,
  onToggle,
  onClick,
}: MenuModuleHeaderProps) {
  return (
    <View
      className={cx(styles.moduleHeader, expanded && styles.moduleHeaderOpen)}
      onClick={onClick}
      hoverClass={onClick ? styles.nodeHover : undefined}
    >
      <View
        className={styles.moduleHeader__toggle}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        hoverClass={styles.nodeHover}
        aria-label={expanded ? '收起' : '展开'}
        aria-expanded={expanded}
      >
        <LineIcon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} color="#4E5969" />
      </View>
      <View className={styles.moduleHeader__icon}>
        <LineIcon name="folder" size={18} color="#1677FF" />
      </View>
      <Text className={styles.moduleHeader__title}>{title}</Text>
      <Text className={styles.moduleHeader__count}>{count}</Text>
      <View className={styles.arrow}>
        <LineIcon name="chevronRight" size={16} color="#C9CDD4" />
      </View>
    </View>
  )
}

export interface MenuTreeRowProps {
  title: ReactNode
  /** 次要信息：页面行是路由，按钮行是权限标识 */
  description?: ReactNode
  type: MenuResourceType
  /** 相对模块的层级：1 = 页面，2 及更深 = 按钮权限 */
  depth: number
  hasChildren: boolean
  expanded: boolean
  onToggle?: () => void
  onClick?: () => void
}

/**
 * 模块内的一行（页面 / 按钮权限）。
 *
 * 层级靠缩进、间距、图标和字号表达，不画连接线也不加圆点 ——
 * 有图标和字号层级之后，线条只是重复地把已经说清楚的关系再描一遍。
 */
export function MenuTreeRow({
  title,
  description,
  type,
  depth,
  hasChildren,
  expanded,
  onToggle,
  onClick,
}: MenuTreeRowProps) {
  return (
    <View
      className={cx(styles.row, depth === 1 ? styles['row--page'] : styles['row--action'])}
      onClick={onClick}
      hoverClass={onClick ? styles.nodeHover : undefined}
    >
      {/* 一、二级缩进由 row--page / row--action 的左内边距承担；更深的目录嵌套再逐级补一格 */}
      {depth > 2 ? <View style={{ width: (depth - 2) * 16 }} /> : null}

      {/* 箭头槽位始终占位：否则有子节点的行和叶子行的图标会错开，
          同一棵树里（以及菜单管理、工作台管理之间）看起来就像两套缩进。 */}
      {hasChildren ? (
        <View
          className={styles.row__toggle}
          onClick={(event) => {
            event.stopPropagation()
            onToggle?.()
          }}
          hoverClass={styles.nodeHover}
          aria-label={expanded ? '收起' : '展开'}
          aria-expanded={expanded}
        >
          <LineIcon name={expanded ? 'chevronDown' : 'chevronRight'} size={12} color="#86909C" />
        </View>
      ) : (
        <View className={styles.row__toggle} />
      )}

      <View className={styles.row__icon}>
        <MenuNodeIcon type={type} size={depth === 1 ? 16 : 14} />
      </View>
      <Text className={styles.title}>{title}</Text>
      {description ? <Text className={styles.description}>{description}</Text> : null}
      <View className={styles.badgeSlot}>
        <MenuTypeBadge type={type} />
      </View>
      <View className={styles.arrow}>
        <LineIcon name="chevronRight" size={14} color="#C9CDD4" />
      </View>
    </View>
  )
}

export interface MenuTreeProps<T extends TreeNode<T>> {
  tree: readonly T[]
  /** 当前展开的一级模块；null 表示全部折叠。同一时刻只展开一个，避免长列表被拉散 */
  openModuleId: number | null
  /** 搜索/筛选时展开全部模块，否则命中的节点藏在折叠的模块里看不见 */
  allOpen?: boolean
  onToggleModule: (id: number) => void
  /** 模块内更深层级的展开态 */
  expanded: ReadonlySet<number>
  onToggle: (id: number) => void
  /** 由调用方决定节点的标题/描述/类型/交互，保证组件不依赖任何业务类型 */
  renderNode: (node: T, depth: number) => {
    title: ReactNode
    description?: ReactNode
    type: MenuResourceType
  }
  onSelect?: (node: T) => void
}

/**
 * 菜单树容器：按一级模块分组成块渲染。
 *
 * 不是「一列带缩进的行」—— 一级模块自带浅色卡片背景，模块体是白色的，
 * 两者的底色差就是分组边界。读者扫一眼就能回答「我在哪个业务模块、
 * 这个模块下有哪些页面、某个页面有哪些权限」。
 */
export function MenuTree<T extends TreeNode<T>>({
  tree,
  openModuleId,
  allOpen = false,
  onToggleModule,
  expanded,
  onToggle,
  renderNode,
  onSelect,
}: MenuTreeProps<T>) {
  return (
    <View className={styles.tree}>
      {tree.map((module) => {
        const isOpen = allOpen || openModuleId === module.id
        // 模块体里 depth 从 1 起算：一级模块自己不在体内
        const rows = flattenTree(module.children ?? [], expanded, 1)
        return (
          <View className={styles.module} key={module.id}>
            <MenuModuleHeader
              title={renderNode(module, 0).title}
              count={flattenTree(module.children ?? [], new Set()).length}
              expanded={isOpen}
              onToggle={() => onToggleModule(module.id)}
              onClick={onSelect ? () => onSelect(module) : undefined}
            />
            {isOpen ? (
              <View className={styles.moduleBody}>
                {rows.map(({ node, depth, hasChildren, expanded: rowExpanded }) => {
                  const { title, description, type } = renderNode(node, depth)
                  return (
                    <MenuTreeRow
                      key={node.id}
                      title={title}
                      description={description}
                      type={type}
                      depth={depth}
                      hasChildren={hasChildren}
                      expanded={rowExpanded}
                      onToggle={() => onToggle(node.id)}
                      onClick={onSelect ? () => onSelect(node) : undefined}
                    />
                  )
                })}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
