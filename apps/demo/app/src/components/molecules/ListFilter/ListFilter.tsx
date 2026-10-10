import { View, Text, type ITouchEvent } from '@tarojs/components'

import styles from './ListFilter.module.scss'

export interface ListFilterChip {
  key: string
  label: string
  active?: boolean
}

export interface ListFilterProps {
  /** 搜索框 placeholder（不传则不显示搜索框） */
  searchPlaceholder?: string
  keyword?: string
  onSearchChange?: (value: string) => void
  /** 顶部筛选 chips（不传则不显示） */
  chips?: ListFilterChip[]
  onChipClick?: (key: string) => void
  className?: string
  onClick?: (e: ITouchEvent) => void
}

/**
 * 列表顶部的搜索 + 筛选组合条
 *  - searchPlaceholder 不传 → 不显示搜索框
 *  - chips.length === 0 → 不显示 chips
 */
export function ListFilter({
  searchPlaceholder,
  keyword,
  onSearchChange,
  chips = [],
  onChipClick,
  className,
}: ListFilterProps) {
  const cls = [styles.mListFilter, className ?? ''].filter(Boolean).join(' ')

  return (
    <View className={cls}>
      {searchPlaceholder ? (
        <View className={styles.mListFilter__search}>
          <Text className={styles.mListFilter__searchIcon}>⌕</Text>
          <input
            className={styles.mListFilter__searchInput}
            type="text"
            placeholder={searchPlaceholder}
            value={keyword}
            onInput={(e) => onSearchChange?.((e.target as HTMLInputElement).value)}
            // Taro H5 兼容：原生 input 通过 onInput 即可
          />
        </View>
      ) : null}
      {chips.length > 0 ? (
        <View className={styles.mListFilter__chips}>
          {chips.map((c) => (
            <View
              key={c.key}
              className={[
                styles.mListFilter__chip,
                c.active ? styles['mListFilter__chip--active'] : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onChipClick?.(c.key)}
            >
              <Text className={styles.mListFilter__chipText}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export default ListFilter
