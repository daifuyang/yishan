import { View, Text, type ITouchEvent } from '@tarojs/components'

import { AppText } from '@/components/atoms'
import { navigateBack } from '@/utils/router'

import styles from './PageHeader.module.scss'

export interface PageHeaderProps {
  title: React.ReactNode
  /** 显示返回按钮（默认 true） */
  showBack?: boolean
  /** 自定义返回逻辑；不传则走默认 navigateBack */
  onBack?: () => void
  /** 右侧操作槽：可放按钮 / 文字按钮 */
  right?: React.ReactNode
  /** 副标题 */
  subtitle?: React.ReactNode
  /** 背景色，默认 var(--color-bg-surface) */
  bordered?: boolean
  className?: string
  onClick?: (e: ITouchEvent) => void
}

export function PageHeader({
  title,
  showBack = true,
  onBack,
  right,
  subtitle,
  bordered = true,
  className,
}: PageHeaderProps) {
  const handleBack = () => {
    if (onBack) return onBack()
    navigateBack(1)
  }

  const cls = [
    styles.mPageHeader,
    bordered ? styles['mPageHeader--bordered'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={cls}>
      <View className={styles.mPageHeader__inner}>
        {showBack ? (
          <View
            className={styles.mPageHeader__back}
            onClick={handleBack}
            hoverClass={styles.mPageHeader__backHover}
          >
            <Text className={styles.mPageHeader__backIcon}>‹</Text>
          </View>
        ) : (
          <View className={styles.mPageHeader__placeholder} />
        )}

        <View className={styles.mPageHeader__titleWrap}>
          <AppText
            size={16}
            weight="semibold"
            className={styles.mPageHeader__title}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              size={12}
              variant="tertiary"
              className={styles.mPageHeader__subtitle}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>

        <View className={styles.mPageHeader__right}>
          {right}
        </View>
      </View>
    </View>
  )
}

export default PageHeader
