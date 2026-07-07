import { View, Text } from '@tarojs/components'
import { useRouter, switchTab, navigateTo } from '@tarojs/taro'

import { IconFont } from '@/components/icons'

import styles from './TabBar.module.scss'

export interface TabBarItem {
  pagePath: string
  text: string
  icon: string
}

export interface TabBarProps {
  currentPath?: string
  list?: TabBarItem[]
}

const DEFAULT_LIST: TabBarItem[] = [
  { pagePath: 'pages/index/index', text: '首页', icon: 'home' },
  { pagePath: 'pages/apps/index', text: '功能', icon: 'apps' },
  { pagePath: 'pages/mine/index', text: '我的', icon: 'user' },
]

export function TabBar({ currentPath, list = DEFAULT_LIST }: TabBarProps) {
  const router = useRouter()
  const active = currentPath ?? router.path ?? ''

  const handleClick = (item: TabBarItem) => {
    if (item.pagePath === active) return
    const url = `/${item.pagePath}`
    if (item.pagePath === 'pages/index/index'
      || item.pagePath === 'pages/apps/index'
      || item.pagePath === 'pages/mine/index') {
      switchTab({ url })
    } else {
      navigateTo({ url })
    }
  }

  return (
    <View className={styles.tabbar}>
      {list.map((item) => {
        const isActive = item.pagePath === active
        return (
          <View
            key={item.pagePath}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => handleClick(item)}
          >
            <View className={styles.tabIcon}>
              <IconFont
                name={item.icon}
                size={22}
                color={isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)'}
              />
            </View>
            <Text
              className={`${styles.tabText} ${isActive ? styles.tabActiveText : ''}`}
            >
              {item.text}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export default TabBar
