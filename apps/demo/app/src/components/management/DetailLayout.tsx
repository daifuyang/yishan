import { Text, View } from '@tarojs/components'
import { useState, type ReactNode } from 'react'

import { Avatar } from '@/components/atoms'
import styles from './DetailLayout.module.scss'
import { LineIcon, type LineIconName } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface DetailContentProps {
  children: ReactNode
  className?: string
}

/** 详情页正文容器，统一外边距。 */
export function DetailContent({ children, className = '' }: DetailContentProps) {
  return <View className={cx(styles.content, className)}>{children}</View>
}

export interface DetailHeroProps {
  title: ReactNode
  /** 标题右侧标签，通常是状态 */
  tag?: ReactNode
  /** 标题右侧补充文字，例如「系统角色」 */
  note?: ReactNode
  /** 副标题第一行，例如 @账号 */
  subtitle?: ReactNode
  /** 副标题第二行，例如组织归属 */
  footnote?: ReactNode
  avatar?: { src?: string; name: string }
  avatarClassName?: string
  glyph?: LineIconName
  glyphColor?: string
  /**
   * 自定义图标节点，优先于 glyph。用于「同一语义在不同页面必须长得一样」的场景
   * （如菜单资源类型：列表和详情复用同一个 MenuTypeIcon）。
   */
  icon?: ReactNode
}

/** 详情页顶部摘要：头像/图标 + 名称 + 标签 + 副标题。 */
export function DetailHero({
  title,
  tag,
  note,
  subtitle,
  footnote,
  avatar,
  avatarClassName,
  glyph,
  glyphColor = '#1677FF',
  icon,
}: DetailHeroProps) {
  return (
    <View className={styles.hero}>
      {avatar ? (
        <Avatar
          src={avatar.src}
          name={avatar.name}
          size="lg"
          shape="circle"
          className={avatarClassName}
        />
      ) : icon ? (
        <View className={styles.hero__glyph}>{icon}</View>
      ) : glyph ? (
        <View className={styles.hero__glyph}>
          <LineIcon name={glyph} size={24} color={glyphColor} />
        </View>
      ) : null}
      <View className={styles.hero__info}>
        {/* 第一行只放标题和状态 —— 这两个是「这是什么、现在什么状态」，
            是扫一眼就要拿到的东西。 */}
        <View className={styles.hero__titleLine}>
          <Text className={styles.hero__title}>{title}</Text>
          {tag}
        </View>
        {/* 第二行放补充说明（描述、类型、备注）。跟状态挤在一行会让标题行
            横向拉得很长，扫读时反而找不到标题。 */}
        {subtitle || note || footnote ? (
          <View className={styles.hero__metaLine}>
            {subtitle ? <Text className={styles.hero__subtitle}>{subtitle}</Text> : null}
            {note ? <Text className={styles.hero__note}>{note}</Text> : null}
            {footnote ? <Text className={styles.hero__footnote}>{footnote}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

export interface DetailSectionProps {
  title: string
  children: ReactNode
  className?: string
  /** 标题变为可点击的展开/收起控制 */
  collapsible?: boolean
  defaultCollapsed?: boolean
}

/** 详情页信息分组：灰色标题浮在页面底色上，标题下方是一块无圆角的全出血白底。 */
export function DetailSection({
  title,
  children,
  className = '',
  collapsible = false,
  defaultCollapsed = false,
}: DetailSectionProps) {
  const [open, setOpen] = useState(!defaultCollapsed)
  return (
    <View className={cx(styles.sectionBlock, className)}>
      <Text
        className={cx(styles.section__title, collapsible && styles.section__titleToggle)}
        aria-expanded={collapsible ? open : undefined}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        {title}
        {collapsible ? (
          <LineIcon
            name={open ? 'chevronDown' : 'chevronRight'}
            size={14}
            color="#86909C"
          />
        ) : null}
      </Text>
      {collapsible && !open ? null : <View className={styles.section}>{children}</View>}
    </View>
  )
}

export interface DetailRowProps {
  label: string
  value?: string | number | ReactNode
  /** 渲染右侧箭头。省略时按 onClick 推导：可点即有箭头 */
  showArrow?: boolean
  onClick?: () => void
  /** 'muted' 弱化值文字，用于未设置态 */
  tone?: 'default' | 'muted'
  /** 长文本（描述、备注）：占满整行、左对齐换行，不挤在右列 */
  multiline?: boolean
}

/** 分组内的「标签 : 值」行，空值统一显示「未设置」。 */
export function DetailRow({
  label,
  value,
  showArrow,
  onClick,
  tone = 'default',
  multiline = false,
}: DetailRowProps) {
  const empty = value === undefined || value === null || value === ''
  const arrow = showArrow ?? Boolean(onClick)
  if (multiline) {
    return (
      <View className={cx(styles.row, styles['row--multiline'], onClick && styles['row--tappable'])} onClick={onClick} hoverClass={onClick ? styles['row--hover'] : undefined}>
        <Text className={styles.row__label}>{label}</Text>
        <Text className={cx(styles.row__block, (empty || tone === 'muted') && styles['row__value--muted'])} selectable={!onClick}>
          {empty ? '未设置' : value}
        </Text>
      </View>
    )
  }
  return (
    <View
      className={cx(styles.row, onClick && styles['row--tappable'])}
      onClick={onClick}
      hoverClass={onClick ? styles['row--hover'] : undefined}
    >
      <Text className={styles.row__label}>{label}</Text>
      <View className={styles.row__tail}>
        <Text
          className={cx(
            styles.row__value,
            (empty || tone === 'muted') && styles['row__value--muted'],
          )}
          selectable={!onClick}
        >
          {empty ? '未设置' : value}
        </Text>
        {arrow ? <LineIcon name="chevronRight" size={16} color="#C9CDD4" /> : null}
      </View>
    </View>
  )
}

export interface DetailGroupListProps {
  /** 权限按模块分组后的结果 */
  groups: readonly { name: string; items: readonly string[] }[]
}

/** 权限分组展示：以模块名为标题、成员为 chip，不直接暴露关联 ID。 */
export function DetailGroupList({ groups }: DetailGroupListProps) {
  if (groups.length === 0) {
    return (
      <View className={styles.groupBlock}>
        <Text className={styles.row__label}>未配置任何权限</Text>
      </View>
    )
  }
  return (
    <>
      {groups.map((group) => (
        <View className={styles.groupBlock} key={group.name}>
          <Text className={styles.groupBlock__name}>{group.name}</Text>
          <View className={styles.groupBlock__items}>
            {group.items.map((item) => (
              <View className={styles.chip} key={item}>
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  )
}
