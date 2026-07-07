import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'

import { AppText } from '@/components/atoms'
import { ListItem, SectionHeader } from '@/components/molecules'
import { contactsApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { SECONDARY_PAGES } from '@/constants/routes'
import type { SysMenuNode } from '@/api/types'

import styles from './index.module.scss'

interface DeptFlatNode {
  id: number
  name: string
  parentId?: number | null
  hasChildren: boolean
}

function flatten(tree: SysMenuNode[], depth = 0, out: DeptFlatNode[] = []): DeptFlatNode[] {
  for (const n of tree) {
    out.push({
      id: n.id,
      name: n.name,
      parentId: n.parentId ?? null,
      hasChildren: !!n.children && n.children.length > 0,
    })
    if (n.children && n.children.length > 0) {
      flatten(n.children, depth + 1, out)
    }
  }
  return out
}

export default function ContactsIndex() {
  const [depts, setDepts] = useState<DeptFlatNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useRequireAuth()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const tree = await contactsApi.getDeptTree()
      setDepts(flatten(tree || []))
    } catch (e) {
      setError((e as Error).message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useDidShow(() => load())

  const openDept = (id: number, name: string) => {
    navigateTo(
      `/${SECONDARY_PAGES.contactsDept}?id=${id}&name=${encodeURIComponent(name)}`
    )
  }

  return (
    <View className="page-container">
      <SectionHeader title="部门" showMore={false} />

      {loading && depts.length === 0 ? (
        <View className={styles.contacts__state}>
          <AppText size={13} variant="tertiary">
            加载中…
          </AppText>
        </View>
      ) : error ? (
        <View className={styles.contacts__state}>
          <AppText size={13} variant="tertiary">
            {error}
          </AppText>
        </View>
      ) : depts.length === 0 ? (
        <View className={styles.contacts__state}>
          <AppText size={13} variant="tertiary">
            暂无部门
          </AppText>
        </View>
      ) : (
        <View className={styles.contacts__list}>
          {depts.map((d, idx) => (
            <View key={d.id}>
              <ListItem
                title={
                  <View className={styles.contacts__title}>
                    <Text className={styles.contacts__name}>{d.name}</Text>
                  </View>
                }
                showArrow
                bordered={idx < depts.length - 1}
                onClick={() => openDept(d.id, d.name)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
