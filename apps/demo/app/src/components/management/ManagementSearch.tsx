import { Input, Text, View } from '@tarojs/components'
import type { ReactNode } from 'react'

import { LineIcon } from './LineIcon'

import styles from './ManagementSearch.module.scss'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface ManagementFilterBarProps {
  children: ReactNode
  className?: string
}

/** 搜索 + 筛选组合区，容器负责底色与间距。 */
export function ManagementFilterBar({ children, className = '' }: ManagementFilterBarProps) {
  return <View className={cx(styles.filters, className)}>{children}</View>
}

export interface ManagementSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

/** 统一搜索框：真实输入、可清除。防抖由 useListPagination 负责。 */
export function ManagementSearchBar({
  value,
  onChange,
  placeholder = '搜索',
  disabled = false,
}: ManagementSearchBarProps) {
  return (
    <View className={styles.search}>
      <LineIcon name="search" size={18} color="var(--color-text-tertiary)" className={styles.search__icon} />
      <Input
        className={styles.search__input}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onInput={(event) => onChange(event.detail.value)}
      />
      {value ? (
        <View
          className={styles.search__clear}
          onClick={() => onChange('')}
          hoverClass={styles.search__clearHover}
          aria-label="清除搜索"
        >
          <Text className={styles.search__clearIcon}>×</Text>
        </View>
      ) : null}
    </View>
  )
}

export interface FilterTab {
  key: string
  label: string
}

export interface ManagementFilterTabsProps {
  tabs: readonly FilterTab[]
  active: string
  onChange: (key: string) => void
}

/** 统一状态筛选 chips。 */
export function ManagementFilterTabs({ tabs, active, onChange }: ManagementFilterTabsProps) {
  return (
    <View className={styles.chips}>
      {tabs.map((tab) => (
        <View
          key={tab.key || 'all'}
          className={cx(styles.chip, active === tab.key && styles.chipActive)}
          onClick={() => onChange(tab.key)}
          hoverClass={styles.chipHover}
          aria-label={tab.label}
        >
          <Text>{tab.label}</Text>
        </View>
      ))}
    </View>
  )
}

export interface ManagementFilterTrigger {
  /** 稳定标识，同时作为展开面板的 key */
  key: string
  /** 触发器当前显示的文案 */
  label: string
  /** 已命中该条件：转主色并加粗 */
  active?: boolean
}

export interface ManagementFilterTriggersProps {
  triggers: readonly ManagementFilterTrigger[]
  /** 当前展开面板的 key，null 表示全部收起 */
  panel: string | null
  onPanelChange: (key: string) => void
}

/**
 * 统一筛选触发器行：等分排布，已命中或展开时转主色。
 *
 * 只负责触发器本身；选项面板（BottomSelectSheet / DateRangeSheet）由页面挂载，
 * 因为各页的选项集与草稿逻辑不同。
 */
export function ManagementFilterTriggers({
  triggers,
  panel,
  onPanelChange,
}: ManagementFilterTriggersProps) {
  return (
    <View className={styles.triggers}>
      {triggers.map((trigger) => {
        const on = trigger.active || panel === trigger.key
        return (
          <View
            key={trigger.key}
            className={cx(styles.trigger, on && styles.triggerActive)}
            aria-label={trigger.label}
            aria-expanded={panel === trigger.key}
            onClick={() => onPanelChange(trigger.key)}
          >
            <Text className={styles.triggerLabel}>{trigger.label}</Text>
            <LineIcon name="chevronDown" size={14} color={on ? 'var(--color-primary)' : 'var(--color-text-secondary)'} />
          </View>
        )
      })}
    </View>
  )
}

export interface ManagementFilterSummaryProps {
  children: ReactNode
  onClear: () => void
  clearLabel?: string
}

/** 已命中筛选的摘要行：整行可点，点即清除该条件。 */
export function ManagementFilterSummary({
  children,
  onClear,
  clearLabel = '清除筛选',
}: ManagementFilterSummaryProps) {
  return (
    <View className={styles.summary} onClick={onClear} aria-label={clearLabel}>
      <Text className={styles.summaryText}>{children}</Text>
      <LineIcon name="close" size={14} color="var(--color-primary)" />
    </View>
  )
}

export interface ManagementFilterClearProps {
  label?: string
  onClick: () => void
}

/**
 * 筛选条下方的清除入口（通常只出现在空结果时）。
 *
 * 位于白底筛选条之外，靠自身上内边距与白块拉开距离；用文字而非顶栏动作按钮，
 * 免得在非顶栏位置出现「＋」图标。
 */
export function ManagementFilterClear({
  label = '清除筛选',
  onClick,
}: ManagementFilterClearProps) {
  return (
    <View className={styles.clear} onClick={onClick} aria-label={label}>
      <Text className={styles.clearAction}>{label}</Text>
    </View>
  )
}

