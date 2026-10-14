import { Text, View } from '@tarojs/components'
import type { ReactNode } from 'react'

import { navigateBack } from '@/utils/router'

import styles from './ManagementPage.module.scss'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface ManagementPageProps {
  children: ReactNode
  /** 底部有固定操作栏时预留 50px + 安全区 */
  withActions?: boolean
  /** 页面底部固定操作，与正文预留空间一起渲染。 */
  bottomActions?: ReactNode
  className?: string
}

/** 管理类页面外壳：背景、内边距、滚动与安全区。 */
export function ManagementPage({
  children,
  withActions = false,
  bottomActions,
  className = '',
}: ManagementPageProps) {
  return (
    <View className={cx(styles.page, (withActions || Boolean(bottomActions)) && styles.pageWithActions, className)}>
      {children}
      {bottomActions ? (
        <View className={styles.bottomActions}>
          <View className={styles.bottomActions__content}>{bottomActions}</View>
        </View>
      ) : null}
    </View>
  )
}

export interface ManagementPageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** 小程序顶栏操作；H5 操作放入 ManagementPage.bottomActions。 */
  action?: ReactNode
  /** 底部分隔线，默认 true；嵌在白色内容块里时置 false */
  bordered?: boolean
  className?: string
  onBack?: () => void
  /** 是否显示自绘返回按钮。H5 使用宿主导航，不渲染此顶栏。 */
  showBack?: boolean
}

/** 管理类页面统一顶栏：返回 + 标题 + 计数副标题 + 右侧操作。 */
export function ManagementPageHeader({
  title,
  subtitle,
  action,
  bordered = true,
  className = '',
  onBack,
  showBack = true,
}: ManagementPageHeaderProps) {
  if (process.env.TARO_ENV === 'h5') return null
  return (
    <View className={cx(styles.header, bordered && styles.headerBordered, className)}>
      <View className={cx(styles.header__side, styles.header__sideLeft)}>
        {showBack ? (
          <View
            className={styles.header__sideLeft}
            onClick={onBack ?? (() => navigateBack(1))}
            hoverClass={styles.header__hover}
            aria-label="返回"
          >
            <Text className={styles.header__back}>‹</Text>
          </View>
        ) : null}
      </View>
      <View className={styles.header__titleWrap}>
        <Text className={styles.header__title}>{title}</Text>
        {subtitle ? <Text className={styles.header__subtitle}>{subtitle}</Text> : null}
      </View>
      <View className={cx(styles.header__side, styles.header__sideRight)}>{action}</View>
    </View>
  )
}

export interface ManagementHeaderActionProps {
  label: string
  onClick: () => void
  disabled?: boolean
  /** 无需图标时置 false（如角色页的「新建」） */
  showIcon?: boolean
}

/** 顶栏右上角动作按钮，默认形态与用户管理一致。 */
export function ManagementHeaderAction({
  label,
  onClick,
  disabled = false,
  showIcon = true,
}: ManagementHeaderActionProps) {
  return (
    <View
      className={cx(styles.header__action, disabled && styles.header__actionDisabled)}
      onClick={disabled ? undefined : onClick}
      hoverClass={styles.header__hover}
      aria-label={label}
      aria-disabled={disabled}
    >
      {showIcon ? <Text className={styles.header__actionIcon}>+</Text> : null}
      <Text>{label}</Text>
    </View>
  )
}
