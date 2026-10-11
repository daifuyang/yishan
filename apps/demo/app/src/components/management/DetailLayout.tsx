import { Text, View } from '@tarojs/components'
import type { ReactNode } from 'react'

import { Avatar, Tag } from '@/components/atoms'
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
      ) : glyph ? (
        <View className={styles.hero__glyph}>
          <LineIcon name={glyph} size={24} color={glyphColor} />
        </View>
      ) : null}
      <View className={styles.hero__info}>
        <View className={styles.hero__titleLine}>
          <Text className={styles.hero__title}>{title}</Text>
          {tag ? <Tag>{tag}</Tag> : null}
          {note ? <Text className={styles.hero__note}>{note}</Text> : null}
        </View>
        {subtitle ? <Text className={styles.hero__subtitle}>{subtitle}</Text> : null}
        {footnote ? <Text className={styles.hero__footnote}>{footnote}</Text> : null}
      </View>
    </View>
  )
}

export interface DetailSectionProps {
  title: string
  children: ReactNode
  className?: string
}

/** 详情页信息分组：白色圆角容器 + 分组标题。 */
export function DetailSection({ title, children, className = '' }: DetailSectionProps) {
  return (
    <View className={cx(styles.section, className)}>
      <Text className={styles.section__title}>{title}</Text>
      {children}
    </View>
  )
}

export interface DetailRowProps {
  label: string
  value?: string | number | ReactNode
}

/** 分组内的「标签 : 值」行，空值统一显示「未设置」。 */
export function DetailRow({ label, value }: DetailRowProps) {
  const empty = value === undefined || value === null || value === ''
  return (
    <View className={styles.row}>
      <Text className={styles.row__label}>{label}</Text>
      <Text className={styles.row__value} selectable>
        {empty ? '未设置' : value}
      </Text>
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
