import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'

import { Avatar, AppText } from '@/components/atoms'
import { ListItem, SectionHeader } from '@/components/molecules'
import { contactsApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { firstChar } from '@/utils/format'
import type { DeptUser } from '@/api/types'

import styles from './index.module.scss'

export default function ContactsDept() {
  const router = useRouter()
  const deptId = Number(router.params.id)
  const deptName = router.params.name || '部门'

  const [users, setUsers] = useState<DeptUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useRequireAuth()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await contactsApi.getDeptUsers(deptId)
      setUsers(data || [])
    } catch (e) {
      setError((e as Error).message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (deptId) {
      Taro.setNavigationBarTitle({ title: `${deptName}成员` })
      load()
    }
  }, [deptId])

  return (
    <View className="page-container">
      <SectionHeader title={deptName} showMore={false} />

      {loading && users.length === 0 ? (
        <View className={styles.dept__state}>
          <AppText size={13} variant="tertiary">
            加载中…
          </AppText>
        </View>
      ) : error ? (
        <View className={styles.dept__state}>
          <AppText size={13} variant="tertiary">
            {error}
          </AppText>
        </View>
      ) : users.length === 0 ? (
        <View className={styles.dept__state}>
          <AppText size={13} variant="tertiary">
            该部门暂无成员
          </AppText>
        </View>
      ) : (
        <View className={styles.dept__list}>
          {users.map((u, idx) => (
            <View key={u.id}>
              <ListItem
                icon={
                  <Avatar
                    src={u.avatar}
                    name={u.realName || u.username}
                    size="sm"
                    shape="circle"
                  />
                }
                title={
                  <View className={styles.dept__title}>
                    <Text className={styles.dept__name}>
                      {u.realName || u.username || '-'}
                    </Text>
                    <Text className={styles.dept__initial}>{firstChar(u.realName || u.username)}</Text>
                  </View>
                }
                value={u.phone || u.email || '-'}
                showArrow={false}
                bordered={idx < users.length - 1}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
