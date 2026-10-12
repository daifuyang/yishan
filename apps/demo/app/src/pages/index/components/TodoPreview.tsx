import { Text, View } from '@tarojs/components'

import type { HomeTodoItem } from '../home-todos'
import { HomeIcon } from './HomeIcon'
import { InlineState } from './HomeSection'
import styles from './TodoPreview.module.scss'

export interface TodoPreviewProps {
  items: readonly HomeTodoItem[]
  loaded: boolean
  loading: boolean
  error: string | null
  onRetry: () => void
  onOpen: (item: HomeTodoItem) => void
}

export function TodoPreview({ items, loaded, loading, error, onRetry, onOpen }: TodoPreviewProps) {
  if (error && items.length === 0) return <InlineState text={error} onRetry={onRetry} />
  if (!loaded && loading) return <InlineState text="加载中…" />
  if (items.length === 0) return <InlineState text="暂无待办" />
  return (
    <View className={styles.list}>
      {items.map((item, index) => (
        <View
          key={item.id}
          className={`${styles.row} ${index > 0 ? styles['row--divided'] : ''}`}
          hoverClass={styles['row--pressed']}
          onClick={() => onOpen(item)}
        >
          <View
            className={`${styles.row__icon} ${item.priority !== 'normal' ? styles['row__icon--alert'] : ''}`}
          >
            <HomeIcon
              name={item.icon ?? 'listTodo'}
              size={18}
              color={item.priority !== 'normal' ? '#F53F3F' : '#1677FF'}
            />
          </View>
          <View className={styles.row__main}>
            <Text className={styles.row__title}>{item.title}</Text>
            {item.meta ? <Text className={styles.row__meta}>{item.meta}</Text> : null}
          </View>
          <Text className={styles.row__arrow}>›</Text>
        </View>
      ))}
    </View>
  )
}

export default TodoPreview
