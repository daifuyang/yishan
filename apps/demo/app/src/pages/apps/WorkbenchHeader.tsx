import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import styles from './index.module.scss'

// 与首页一致：自绘导航需要让出状态栏和微信胶囊。刷新走下拉与回到页面时的自动加载。
// statusBar 为 0（H5）时不写 inline 内边距，改由 .apps__top 的 var(--safe-area-top) 避让。
function getHeaderMetrics() {
  if (process.env.TARO_ENV !== 'weapp') return { statusBar: 0, height: 56 }
  try {
    const { statusBarHeight = 20 } = Taro.getWindowInfo()
    const capsule = Taro.getMenuButtonBoundingClientRect()
    return {
      statusBar: statusBarHeight,
      height: capsule.height + Math.max(capsule.top - statusBarHeight, 4) * 2,
    }
  } catch {
    return { statusBar: 20, height: 44 }
  }
}

export function WorkbenchHeader() {
  const [metrics] = useState(getHeaderMetrics)
  return (
    <View
      className={styles.apps__top}
      style={metrics.statusBar ? { paddingTop: `${metrics.statusBar}px` } : undefined}
    >
      <View className={styles.apps__header} style={{ height: `${metrics.height}px` }}>
        <Text className={styles.apps__pageTitle}>工作台</Text>
      </View>
    </View>
  )
}
