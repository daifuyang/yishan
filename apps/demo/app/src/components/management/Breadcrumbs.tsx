import { Text, View } from '@tarojs/components'

import { LineIcon } from './LineIcon'
import styles from './Breadcrumbs.module.scss'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface BreadcrumbItem {
  /** 稳定 key，通常用 id / code */
  key: string | number
  label: string
}

export interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[]
  /** 跳到第 n 级；n = -1 表示回到根（全部） */
  onNavigate: (index: number) => void
  className?: string
}

/**
 * 层级面包屑：从根到当前层的路径，每一级都可点回退。
 *
 * 层级下钻是树形数据的通用交互，裸 Text 手搓一份会在每个页面长出不同的间距和
 * 分隔符；最后首页面包屑和地区面包屑看起来不像同一个产品。
 */
export function Breadcrumbs({ items, onNavigate, className = '' }: BreadcrumbsProps) {
  return (
    <View className={cx(styles.crumbs, className)}>
      <View
        className={cx(styles.crumb, items.length === 0 && styles.crumbCurrent)}
        onClick={() => onNavigate(-1)}
        aria-label="全部"
      >
        <Text>全部</Text>
      </View>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <View
            key={item.key}
            className={cx(styles.crumb, isLast && styles.crumbCurrent)}
            onClick={() => onNavigate(index)}
            aria-label={item.label}
          >
            <LineIcon name="chevronRight" size={12} color="var(--color-text-quaternary)" />
            <Text className={styles.crumbLabel}>{item.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
