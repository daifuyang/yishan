import { useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { WorkbenchApp } from '@/modules/registry'
import { MAX_COMMON_APPS, useModuleStore } from '@/stores/modules'
import styles from './index.module.scss'

export function FavoritesEditor({
  apps,
  onClose,
}: {
  apps: readonly WorkbenchApp[]
  onClose: () => void
}) {
  const commonIds = useModuleStore((state) => state.commonModuleIds)
  const [draft, setDraft] = useState(commonIds)
  const [error, setError] = useState<string | null>(null)
  const selected = draft.filter((id) => apps.some((app) => app.id === id))
  const others = apps.filter((app) => !selected.includes(app.id))

  const move = (index: number, offset: number) => {
    const next = [...selected]
    const target = index + offset
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setDraft(next)
  }

  const save = () => {
    try {
      useModuleStore.getState().setCommonModules(selected)
      Taro.showToast({ title: '常用应用已保存', icon: 'success' })
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '保存失败，请重试')
    }
  }

  return (
    <View className={styles.apps__editor}>
      <View className={styles.apps__sectionHeader}>
        <Text className={styles.apps__title}>编辑常用应用</Text>
        <Button className={styles.apps__action} onClick={onClose}>
          取消
        </Button>
        <Button className={styles.apps__action} onClick={save}>
          完成
        </Button>
      </View>
      <Text className={styles.apps__hint}>
        已选 {selected.length}/{MAX_COMMON_APPS}，通过上移、下移调整顺序
      </Text>
      {selected.length === 0 ? <Text className={styles.apps__hint}>请选择常用应用</Text> : null}
      {selected.map((id, index) => (
        <View key={id} className={styles.apps__editRow}>
          <Text className={styles.apps__editName}>{apps.find((app) => app.id === id)?.name}</Text>
          <Button
            className={styles.apps__action}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          >
            上移
          </Button>
          <Button
            className={styles.apps__action}
            disabled={index === selected.length - 1}
            onClick={() => move(index, 1)}
          >
            下移
          </Button>
          <Button
            className={styles.apps__action}
            onClick={() => setDraft(selected.filter((value) => value !== id))}
          >
            移除
          </Button>
        </View>
      ))}
      <Text className={styles.apps__category}>可添加应用</Text>
      {others.map((app) => (
        <View key={app.id} className={styles.apps__editRow}>
          <Text className={styles.apps__editName}>{app.name}</Text>
          <Button
            className={styles.apps__action}
            disabled={selected.length >= MAX_COMMON_APPS}
            onClick={() => setDraft([...selected, app.id])}
          >
            添加
          </Button>
        </View>
      ))}
      {error ? <Text className={styles.apps__saveError}>{error}</Text> : null}
    </View>
  )
}
