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
      <LineIcon name="search" size={18} color="#86909C" className={styles.search__icon} />
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
