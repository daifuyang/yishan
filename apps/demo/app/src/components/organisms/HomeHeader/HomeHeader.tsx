import { View } from '@tarojs/components'

import { AppText } from '@/components/atoms'
import { SearchBar } from '@/components/molecules'
import { ICONS } from '@/components/icons/icons'

import styles from './HomeHeader.module.scss'

export interface HomeHeaderProps {
  greeting?: string
  username?: string
  dateText?: string
  searchPlaceholder?: string
  onSearchClick?: () => void
  onNoticeClick?: () => void
}

export function HomeHeader({
  greeting = 'Hi, 你好',
  username = '访客',
  dateText = '今天',
  searchPlaceholder = '搜索功能、内容、订单…',
  onSearchClick,
  onNoticeClick,
}: HomeHeaderProps) {
  return (
    <View className={styles.oHomeHeader}>
      <View className={styles.oHomeHeader__top}>
        <View className={styles.oHomeHeader__title}>
          <AppText size={20} weight="semibold">
            {greeting}
          </AppText>
          <AppText size={13} variant="tertiary" className={styles.oHomeHeader__name}>
            {username} · {dateText}
          </AppText>
        </View>
        <View className={styles.oHomeHeader__notice} onClick={onNoticeClick}>
          {ICONS.bell}
        </View>
      </View>
      <View className={styles.oHomeHeader__search}>
        <SearchBar
          placeholder={searchPlaceholder}
          readOnly
          onClick={onSearchClick}
        />
      </View>
    </View>
  )
}

export default HomeHeader
