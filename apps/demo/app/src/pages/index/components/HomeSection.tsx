import { Text, View } from '@tarojs/components'

import styles from './HomeSection.module.scss'

export interface HomeSectionProps {
  title: string
  extra?: React.ReactNode
  children: React.ReactNode
}

/** 首页模块：标题行 + 内容，模块间距统一由此控制 */
export function HomeSection({ title, extra, children }: HomeSectionProps) {
  return (
    <View className={styles.section}>
      <View className={styles.section__header}>
        <Text className={styles.section__title}>{title}</Text>
        {extra}
      </View>
      {children}
    </View>
  )
}

export interface SectionLinkProps {
  text: string
  onClick: () => void
}

/** 标题行右侧的「全部 >」入口 */
export function SectionLink({ text, onClick }: SectionLinkProps) {
  return (
    <View className={styles.section__link} hoverClass={styles['section__link--pressed']} onClick={onClick}>
      <Text>{text}</Text>
      <Text className={styles.section__chevron}>›</Text>
    </View>
  )
}

/** 卡片内的紧凑状态行（空 / 失败），避免整屏 StateView 撑高首页 */
export function InlineState({
  text,
  onRetry,
}: {
  text: string
  onRetry?: () => void
}) {
  return (
    <View className={styles.inlineState}>
      <Text className={styles.inlineState__text}>{text}</Text>
      {onRetry ? (
        <Text className={styles.inlineState__retry} onClick={onRetry}>
          重试
        </Text>
      ) : null}
    </View>
  )
}

export default HomeSection
