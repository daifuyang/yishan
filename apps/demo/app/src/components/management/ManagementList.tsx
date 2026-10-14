import { Image, Text, View } from '@tarojs/components'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { AppText, Avatar } from '@/components/atoms'
import { StateView } from '@/components/feedback'

import { LineIcon, type LineIconName } from './LineIcon'

import styles from './ManagementList.module.scss'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface ManagementListProps {
  children: ReactNode
  className?: string
}

/** 白色全出血列表容器（无左右外边距、无圆角），自动在相邻行之间画分割线。 */
export function ManagementList({ children, className = '' }: ManagementListProps) {
  return <View className={cx(styles.list, className)}>{children}</View>
}

export interface ManagementCellProps {
  title: ReactNode
  /** 副标题：只放一行非结构化说明（如「拥有基础管理权限」）；结构化属性放详情页，状态走 tag 列，不用 · 拼接 */
  description?: ReactNode
  /** 标题右侧的状态标签，直接渲染节点（通常是 <Tag>）。只表达状态，不放按钮 */
  tag?: ReactNode
  /** 选择态槽位（勾选框等），渲染在状态列之后、动作槽之前 */
  selection?: ReactNode
  /** 行内动作槽位（上移/下移等按钮）。点击阻止冒泡，不会连带触发整行跳转 */
  trailingAction?: ReactNode
  /** 行首方形缩略图（媒体类列表）；有 src 时图片覆盖在图标上，加载失败露出图标 */
  thumb?: { src?: string; glyph: LineIconName }
  /** 行首头像；不传则用 glyph 图标 */
  avatar?: { src?: string; name: string }
  glyph?: LineIconName
  glyphColor?: string
  /** 行首自定义图形（如应用图标）；thumb / avatar / glyph 都未提供时使用 */
  leading?: ReactNode
  /** 不可操作：整行转为三级灰，不响应点击 */
  disabled?: boolean
  /** 末行补充说明，位于副标题之下 */
  footnote?: ReactNode
  /** 非末行时画分割线，由列表遍历统一注入 */
  bordered?: boolean
  showArrow?: boolean
  onClick?: () => void
  onLongPress?: () => void
}

/**
 * 管理类列表统一 Cell：头像/图标 + 标题 + 标签 + 副标题 + 可选箭头。
 * 只有详情入口才显示箭头；行内动作走 trailingAction（点击阻止冒泡），状态仍由 tag 承载。
 */
export function ManagementCell({
  title,
  description,
  tag,
  selection,
  trailingAction,
  thumb,
  avatar,
  glyph,
  glyphColor = 'var(--color-primary)',
  leading,
  disabled = false,
  footnote,
  bordered = true,
  showArrow = true,
  onClick,
  onLongPress,
}: ManagementCellProps) {
  const longPressProps = process.env.TARO_ENV !== 'h5' && onLongPress ? { onLongPress } : undefined
  // 加载失败的缩略图 src：H5 的破图会盖住下层图标，失败后不再渲染 Image；换了 src 自动重试
  const [brokenSrc, setBrokenSrc] = useState<string | undefined>()
  return (
    <View
      className={cx(styles.row, bordered && styles.rowBordered, disabled && styles.rowDisabled)}
      onClick={disabled ? undefined : onClick}
      hoverClass={onClick && !disabled ? styles.rowHover : undefined}
      {...longPressProps}
    >
      {thumb ? (
        <View className={styles.row__thumb}>
          <LineIcon name={thumb.glyph} size={20} color={glyphColor} />
          {thumb.src && thumb.src !== brokenSrc ? (
            <Image
              className={styles.row__thumbImage}
              src={thumb.src}
              mode="aspectFill"
              lazyLoad
              onError={() => setBrokenSrc(thumb.src)}
            />
          ) : null}
        </View>
      ) : avatar ? (
        <Avatar
          src={avatar.src}
          name={avatar.name}
          size="md"
          shape="circle"
          className={styles.row__avatar}
        />
      ) : glyph ? (
        <View className={styles.row__glyph}>
          <LineIcon name={glyph} size={20} color={glyphColor} />
        </View>
      ) : leading ? (
        <View className={styles.row__leading}>{leading}</View>
      ) : null}
      <View className={styles.row__content}>
        <Text className={styles.row__title}>{title}</Text>
        {/* 只保留一行描述：description 优先，footnote 作为兜底。
            两行并存会把单元格撑成三行，标题和图标就对不齐了。 */}
        {description || footnote ? (
          <Text className={styles.row__description}>{description || footnote}</Text>
        ) : null}
      </View>
      {/* 状态放在右侧独立成列：与整行垂直居中，不必和标题抢同一条基线 */}
      {tag ? <View className={styles.row__tag}>{tag}</View> : null}
      {selection ? <View className={styles.row__selection}>{selection}</View> : null}
      {/* 动作槽拦住冒泡：点行内按钮不应顺带触发整行跳转。拦截放在容器上，
          调用方传什么按钮都成立，不必每个调用点各写一次 stopPropagation。 */}
      {trailingAction ? (
        <View className={styles.row__action} onClick={(event) => event.stopPropagation()}>
          {trailingAction}
        </View>
      ) : null}
      {showArrow ? (
        <View className={styles.row__arrow}>
          <LineIcon name="chevronRight" size={16} color="var(--color-text-quaternary)" />
        </View>
      ) : null}
    </View>
  )
}

export interface ManagementTreeCellProps {
  title: ReactNode
  /** 单行次要信息（路由路径、模块），与标题同行右对齐，不再另起一行 */
  description?: ReactNode
  /** 标题右侧的类型/状态标签 */
  tag?: ReactNode
  glyph?: LineIconName
  glyphColor?: string
  /** 层级深度，顶层为 0。每层缩进 14px，最多 4 层后再缩也不加，避免深树挤成一条缝 */
  depth?: number
  /** 该节点还有子节点：显示展开/收起箭头 */
  hasChildren?: boolean
  /** 当前是否展开，决定箭头朝向 */
  expanded?: boolean
  /** 切换展开态。与行点击分开，否则点行既进详情又折叠 */
  onToggle?: () => void
  bordered?: boolean
  onClick?: () => void
}

/**
 * 树形列表行：单行、紧凑。
 *
 * 树天然比平铺列表长（菜单树动辄几十行），沿用 ManagementCell 的 76px 行高加
 * 44px 图标，一屏只能看三四行，滚动成本极高。所以这里另起一套密度：
 * 行高 48px、图标 16px 无底色、标题与次要信息同行 —— 一屏能看到两倍的节点。
 *
 * 展开箭头是行内独立元素且 stopPropagation：点箭头是折叠，点行是进详情，
 * 共用一个点击区会让用户永远点不准。无子节点的行不画箭头，留白让标题仍然对齐。
 */
export function ManagementTreeCell({
  title,
  description,
  tag,
  glyph,
  glyphColor = 'var(--color-text-tertiary)',
  depth = 0,
  hasChildren = false,
  expanded = false,
  onToggle,
  bordered = true,
  onClick,
}: ManagementTreeCellProps) {
  const indent = Math.min(depth, 4) * 14
  return (
    <View
      className={cx(styles.treeRow, bordered && styles.rowBordered)}
      onClick={onClick}
      hoverClass={onClick ? styles.rowHover : undefined}
      style={indent ? { paddingLeft: `${indent}px` } : undefined}
    >
      {hasChildren ? (
        <View
          className={styles.treeRow__toggle}
          onClick={(event) => {
            event.stopPropagation()
            onToggle?.()
          }}
          hoverClass={styles.rowHover}
          aria-label={expanded ? '收起' : '展开'}
          aria-expanded={expanded}
        >
          <LineIcon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} color="var(--color-text-tertiary)" />
        </View>
      ) : null}
      {glyph ? (
        <View className={styles.treeRow__glyph}>
          <LineIcon name={glyph} size={16} color={glyphColor} />
        </View>
      ) : null}
      <Text className={styles.treeRow__title}>{title}</Text>
      {description ? <Text className={styles.treeRow__description}>{description}</Text> : null}
      {tag ? <View className={styles.treeRow__tag}>{tag}</View> : null}
    </View>
  )
}

export interface ManagementSkeletonProps {
  rows?: number
  className?: string
}
/** 列表骨架屏。 */
export function ManagementSkeleton({ rows = 3, className = '' }: ManagementSkeletonProps) {
  const placeholders = useMemo(
    () => Array.from({ length: rows }, (_, index) => `skeleton-${index}`),
    [rows],
  )
  return (
    <ManagementList className={className}>
      {placeholders.map((key) => (
        <View className={styles.skeleton} key={key} aria-label="加载中">
          <View className={styles.skeleton__glyph} />
          <View className={styles.skeleton__content}>
            <View className={styles.skeleton__title} />
            <View className={styles.skeleton__line} />
          </View>
        </View>
      ))}
    </ManagementList>
  )
}

export interface ManagementStatesProps {
  kind: 'loading' | 'error' | 'empty' | 'ready'
  /** 就绪态内容 */
  children?: ReactNode
  emptyText?: string
  errorText?: string
  onRetry?: () => void
  minHeight?: number
}

/** 列表四态统一出口，页面不再各写一套 loading/empty/error。 */
export function ManagementStates({
  kind,
  children,
  emptyText = '暂无数据',
  errorText = '加载失败，请重试',
  onRetry,
  minHeight = 220,
}: ManagementStatesProps) {
  if (kind === 'loading') return <ManagementSkeleton />
  if (kind === 'empty') return <StateView kind="empty" text={emptyText} minHeight={minHeight} />
  if (kind === 'error') {
    return <StateView kind="error" text={errorText} onRetry={onRetry} minHeight={minHeight} />
  }
  return <>{children}</>
}

export interface ManagementListFooterProps {
  loadingMore?: boolean
  refreshing?: boolean
  finished?: boolean
  count?: number
  empty?: boolean
  /** 底部统计文案，如「共 3 个角色」 */
  summary?: ReactNode
}

/** 列表底部：上拉加载提示 + 统计。 */
export function ManagementListFooter({
  loadingMore = false,
  refreshing = false,
  finished = false,
  empty = false,
  summary,
}: ManagementListFooterProps) {
  const showLoadingMore = !finished && !empty && !refreshing
  if (!showLoadingMore && !summary) return null
  return (
    <>
      {showLoadingMore ? (
        <View className={styles.footer}>
          <AppText size={12} variant="tertiary">
            {loadingMore ? '加载中…' : '上拉加载更多'}
          </AppText>
        </View>
      ) : null}
      {refreshing ? (
        <View className={styles.footer}>
          <AppText size={12} variant="tertiary">
            刷新中…
          </AppText>
        </View>
      ) : null}
      {summary ? (
        <View className={styles.footer}>
          <AppText size={12} variant="tertiary">
            {summary}
          </AppText>
        </View>
      ) : null}
    </>
  )
}
