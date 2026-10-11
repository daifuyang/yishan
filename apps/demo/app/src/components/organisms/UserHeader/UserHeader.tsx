import { Text, View } from '@tarojs/components'

import { Avatar, Tag } from '@/components/atoms'

import styles from './UserHeader.module.scss'

export interface UserHeaderProps {
  name: string
  account?: string
  avatar?: string
  /** 企业身份，如「管理员」；无数据时不展示 */
  identity?: string
  loading?: boolean
}

// H5 保持同一设计语言，仅放宽上下留白
const ROOMY = process.env.TARO_ENV === 'h5'

export function UserHeader({ name, account, avatar, identity, loading = false }: UserHeaderProps) {
  const cls = [styles.header, ROOMY ? styles.header_roomy : ''].filter(Boolean).join(' ')

  if (loading) {
    return (
      <View className={cls} aria-label="加载中">
        <View className={styles.skeleton__avatar} />
        <View className={styles.info}>
          <View className={styles.skeleton__name} />
          <View className={styles.skeleton__account} />
        </View>
      </View>
    )
  }

  return (
    <View className={cls}>
      <Avatar src={avatar} name={name} size="lg" shape="circle" className={styles.avatar} />
      <View className={styles.info}>
        <Text className={styles.name}>{name}</Text>
        {account ? <Text className={styles.account}>{account}</Text> : null}
        {identity ? (
          <View className={styles.identity}>
            <Tag variant="primary">{identity}</Tag>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default UserHeader
