import { Input, Text, View } from '@tarojs/components'
import styles from './ActionBar.module.scss'
import { LineIcon, type LineIconName } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface BottomAction {
  key: string
  label: string
  icon?: LineIconName
  tone?: 'primary' | 'warning' | 'muted'
  onClick: () => void
}

export interface BottomActionBarProps {
  actions: readonly BottomAction[]
  /** 提交或加载中，整条操作栏禁用 */
  disabled?: boolean
}

const TONE_COLOR: Record<NonNullable<BottomAction['tone']>, string> = {
  primary: 'var(--color-primary)',
  warning: 'var(--color-warning)',
  muted: 'var(--color-text-secondary)',
}

/** 详情页底部固定操作栏，按钮等宽并排，行为与用户详情一致。 */
export function BottomActionBar({ actions, disabled = false }: BottomActionBarProps) {
  if (actions.length === 0) return null
  return (
    <View className={styles.bar}>
      <View className={styles.bar__content}>
        {actions.map((action) => (
          <View
            key={action.key}
            className={cx(
              styles.action,
              action.tone === 'primary' && styles.actionPrimary,
              action.tone === 'warning' && styles.actionWarning,
              disabled && styles.actionDisabled,
            )}
            onClick={disabled ? undefined : action.onClick}
            hoverClass={styles.actionPressed}
            aria-label={action.label}
            aria-disabled={disabled}
          >
            {action.icon ? (
              <LineIcon name={action.icon} size={20} color={TONE_COLOR[action.tone ?? 'muted']} />
            ) : null}
            <Text>{action.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export interface ActionSheetItem {
  key: string
  label: string
  icon?: LineIconName
  danger?: boolean
  onClick: () => void
}

export interface ActionSheetProps {
  open: boolean
  title?: string
  items: readonly ActionSheetItem[]
  onClose: () => void
}

/** 底部更多操作面板，承载低频与破坏性动作。 */
export function ActionSheet({ open, title, items, onClose }: ActionSheetProps) {
  if (!open) return null
  return (
    <View className={styles.sheetLayer} catchMove>
      <View className={styles.sheetMask} onClick={onClose} aria-label="关闭更多操作" />
      <View className={styles.sheet} aria-label={title ?? '更多操作'}>
        {title ? (
          <View className={styles.sheet__header}>
            <Text className={styles.sheet__description}>{title}</Text>
          </View>
        ) : null}
        <View className={styles.sheet__menu}>
        {items.map((item) => (
          <View
            key={item.key}
            className={cx(styles.sheet__item, item.danger && styles.sheet__danger)}
            onClick={item.onClick}
            hoverClass={styles.actionPressed}
            aria-label={item.label}
          >
            <Text>{item.label}</Text>
          </View>
        ))}
        </View>
        <View
          className={styles.sheet__cancel}
          onClick={onClose}
          hoverClass={styles.actionPressed}
          aria-label="取消"
        >
          <Text>取消</Text>
        </View>
      </View>
    </View>
  )
}

export interface PromptDialogProps {
  open: boolean
  title: string
  hint?: string
  value: string
  placeholder?: string
  error?: string
  password?: boolean
  confirmText?: string
  cancelText?: string
  /** 无障碍标签，缺省复用按钮文案 */
  confirmAriaLabel?: string
  cancelAriaLabel?: string
  submitting?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}

/** 居中输入弹窗，H5 端替代不支持 editable 的 showModal。 */
export function PromptDialog({
  open,
  title,
  hint,
  value,
  placeholder,
  error,
  password = false,
  confirmText = '确定',
  cancelText = '取消',
  /** 无障碍标签，缺省复用按钮文案 */
  confirmAriaLabel,
  cancelAriaLabel,
  submitting = false,
  onChange,
  onSubmit,
  onClose,
}: PromptDialogProps) {
  if (!open) return null
  return (
    <View className={styles.sheetLayer} catchMove>
      <View className={styles.sheetMask} />
      <View className={styles.dialog}>
        <Text className={styles.sheet__title}>{title}</Text>
        {hint ? <Text className={styles.dialog__hint}>{hint}</Text> : null}
        <Input
          className={styles.dialog__input}
          password={password}
          value={value}
          placeholder={placeholder}
          maxlength={50}
          disabled={submitting}
          onInput={(event) => onChange(event.detail.value)}
        />
        {error ? <Text className={styles.dialog__error}>{error}</Text> : null}
        <View className={styles.dialog__actions}>
          <View
            className={styles.action}
            aria-label={cancelAriaLabel ?? cancelText}
            onClick={submitting ? undefined : onClose}
          >
            <Text>{cancelText}</Text>
          </View>
          <View
            className={cx(styles.action, styles.actionPrimary, submitting && styles.actionDisabled)}
            aria-label={confirmAriaLabel ?? confirmText}
            onClick={submitting ? undefined : onSubmit}
          >
            <Text>{submitting ? '提交中' : confirmText}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
