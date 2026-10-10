import { View } from '@tarojs/components'

import { Avatar, AppText } from '@/components/atoms'
import { ListItem } from '@/components/molecules'
import { ICONS } from '@/components/icons/icons'

import styles from './MineProfile.module.scss'

export interface MineMenuItem {
  key: string
  icon: React.ReactNode
  title: React.ReactNode
  value?: React.ReactNode
}

export interface MineProfileProps {
  username: string
  avatar?: string
  bio?: string
  showStats?: boolean
  stats?: Array<{ label: string; value: string | number }>
  menus?: MineMenuItem[]
  onItemClick?: (key: string) => void
}

export function MineProfile({
  username,
  avatar,
  bio = '未设置简介',
  showStats = false,
  stats = [],
  menus = [],
  onItemClick,
}: MineProfileProps) {
  return (
    <View className={styles.oMine}>
      <View className={styles.oMine__card}>
        <View className={styles.oMine__user}>
          <Avatar
            src={avatar}
            name={username}
            size="lg"
            shape="circle"
          />
          <View className={styles.oMine__userInfo}>
            <AppText size={18} weight="semibold">
              {username}
            </AppText>
            <AppText size={13} variant="tertiary" className={styles.oMine__bio}>
              {bio}
            </AppText>
          </View>
        </View>

        {showStats && stats.length > 0 ? (
          <View className={styles.oMine__stats}>
            {stats.map((s) => (
              <View key={s.label} className={styles.oMine__stat}>
                <AppText size={20} weight="semibold">
                  {s.value}
                </AppText>
                <AppText size={12} variant="tertiary">
                  {s.label}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {menus.length > 0 ? (
        <View className={styles.oMine__menu}>
          {menus.map((m, idx) => (
            <View key={m.key}>
              <ListItem
                icon={m.icon}
                title={m.title}
                value={m.value}
                showArrow
                bordered={idx < menus.length - 1}
                onClick={() => onItemClick?.(m.key)}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export { ICONS }
export default MineProfile
