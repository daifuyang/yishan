import { View } from '@tarojs/components'

import { PageContainer } from '@/components/layout'
import { SettingCell, SettingGroup } from '@/components/molecules'
import { SECONDARY_PAGES } from '@/constants/routes'
import { navigateTo } from '@/utils/router'

import styles from './index.module.scss'

export default function SecurityPage() {
  return (
    <PageContainer>
      <View className={styles.page}>
        <SettingGroup>
          <SettingCell
            icon="lock"
            title="修改密码"
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profilePassword}`)}
          />
          <SettingCell
            icon="history"
            title="登录日志"
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profileLoginLog}`)}
          />
        </SettingGroup>
      </View>
    </PageContainer>
  )
}
