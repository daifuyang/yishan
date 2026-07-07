import { View, Text } from '@tarojs/components'

import { AppText, Button } from '@/components/atoms'
import { EmptyState, Loading } from '@/components/feedback'

import styles from './StateView.module.scss'

export type StateViewKind = 'loading' | 'error' | 'empty' | 'ready'

export interface StateViewProps {
  kind: StateViewKind
  /** 加载 / 错误 / 空 时的文字提示 */
  text?: string
  /** 空 / 错误时附带的次级提示 */
  hint?: string
  /** 错误时是否显示"重试"按钮 */
  onRetry?: () => void
  /** 重试按钮文字 */
  retryText?: string
  /** ready 时显示的内容（列表 / 表单等） */
  children?: React.ReactNode
  /** 自定义错误 / 空态的 icon 字符 */
  icon?: string
  /** 最小高度（px） */
  minHeight?: number
}

export function StateView({
  kind,
  text,
  hint,
  onRetry,
  retryText = '重试',
  children,
  icon,
  minHeight,
}: StateViewProps) {
  if (kind === 'ready') return <>{children}</>

  const wrapStyle: React.CSSProperties | undefined =
    minHeight !== undefined ? { minHeight: `${minHeight}px` } : undefined

  if (kind === 'loading') {
    return (
      <View className={styles.state} style={wrapStyle}>
        <Loading text={text || '加载中…'} />
      </View>
    )
  }

  if (kind === 'empty') {
    return (
      <View className={styles.state} style={wrapStyle}>
        <EmptyState
          text={text || '暂无数据'}
          hint={hint}
        />
      </View>
    )
  }

  // error
  return (
    <View className={styles.state} style={wrapStyle}>
      <View className={styles.state__error}>
        <View className={styles.state__errorIcon}>{icon || '!'}</View>
        <AppText size={14} variant="secondary">
          {text || '加载失败'}
        </AppText>
        {hint ? (
          <Text className={styles.state__hint}>{hint}</Text>
        ) : null}
        {onRetry ? (
          <View className={styles.state__action}>
            <Button size="sm" variant="secondary" onClick={onRetry}>
              {retryText}
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default StateView
