import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import styles from './index.module.scss'

// 与首页一致：自绘导航需要让出状态栏和微信胶囊，刷新放在胶囊对侧。
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

export function WorkbenchHeader({
  loading,
  loaded,
  onRefresh,
}: {
  loading: boolean
  loaded: boolean
  onRefresh: () => void
}) {
  const [metrics] = useState(getHeaderMetrics)
  return (
    <View style={{ paddingTop: `${metrics.statusBar}px` }}>
      <View className={styles.apps__header} style={{ height: `${metrics.height}px` }}>
        <Text className={styles.apps__pageTitle}>工作台</Text>
        <Button
          className={`${styles.apps__action} ${process.env.TARO_ENV === 'weapp' ? styles.apps__miniRefresh : ''}`}
          disabled={loading}
          onClick={onRefresh}
        >
          {loading && loaded ? '刷新中' : '刷新'}
        </Button>
      </View>
    </View>
  )
}
