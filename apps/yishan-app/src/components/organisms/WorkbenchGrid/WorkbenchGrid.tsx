import { View, Text } from '@tarojs/components'

import { GridItem, type GridItemTone, SectionHeader } from '@/components/molecules'

import styles from './WorkbenchGrid.module.scss'

export interface WorkbenchItem {
  key: string
  icon: React.ReactNode
  label: React.ReactNode
  tone?: GridItemTone
  badge?: React.ReactNode
}

export interface WorkbenchGroup {
  key: string
  title?: React.ReactNode
  showTitle?: boolean
  showMore?: boolean
  moreText?: string
  columns?: 3 | 4 | 5
  bordered?: boolean
  items: WorkbenchItem[]
}

export interface WorkbenchGridProps {
  groups: WorkbenchGroup[]
  onItemClick?: (key: string) => void
  onMoreClick?: (groupKey: string) => void
}

export function WorkbenchGrid({
  groups,
  onItemClick,
  onMoreClick,
}: WorkbenchGridProps) {
  return (
    <View className={styles.oWorkbench}>
      {groups.map((group) => {
        const cols = group.columns ?? 4
        const cls = [
          styles.oWorkbench__group,
          group.bordered === false ? '' : styles['oWorkbench__group--bordered'],
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <View key={group.key} className={cls}>
            {group.showTitle !== false && group.title ? (
              <SectionHeader
                title={group.title}
                showMore={group.showMore ?? false}
                moreText={group.moreText}
                onMoreClick={() => onMoreClick?.(group.key)}
              />
            ) : null}
            <View
              className={[
                styles.oWorkbench__grid,
                styles[`oWorkbench__grid--cols-${cols}`],
                styles['oWorkbench__grid--rounded'],
                styles['oWorkbench__grid--bg-surface'],
              ].join(' ')}
            >
              {group.items.map((item) => (
                <GridItem
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  tone={item.tone}
                  badge={item.badge}
                  onClick={() => onItemClick?.(item.key)}
                />
              ))}
            </View>
            {group.items.length === 0 ? (
              <View className={styles.oWorkbench__empty}>
                <Text>暂无应用</Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

export default WorkbenchGrid
