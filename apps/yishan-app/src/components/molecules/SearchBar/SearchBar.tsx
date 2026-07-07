import { View, Text, type ITouchEvent } from '@tarojs/components'

import styles from './SearchBar.module.scss'

export interface SearchBarProps {
  placeholder?: string
  value?: string
  readOnly?: boolean
  showIcon?: boolean
  shape?: 'rounded' | 'square'
  className?: string
  onClick?: (e: ITouchEvent) => void
  onInput?: (value: string) => void
}

export function SearchBar({
  placeholder = '搜索',
  value,
  readOnly = false,
  showIcon = true,
  shape = 'rounded',
  className,
  onClick,
  onInput,
}: SearchBarProps) {
  const cls = [
    styles.mSearchBar,
    shape === 'square' ? styles['mSearchBar--square'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={cls} onClick={onClick}>
      {showIcon ? <Text className={styles.mSearchBar__icon}>⌕</Text> : null}
      {readOnly || !onInput ? (
        <Text className={styles.mSearchBar__placeholder}>{value || placeholder}</Text>
      ) : (
        <Text className={styles.mSearchBar__placeholder}>
          {value ? value : placeholder}
        </Text>
      )}
    </View>
  )
}

export default SearchBar
