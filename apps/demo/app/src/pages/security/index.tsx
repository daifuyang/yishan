import { View } from '@tarojs/components'

import { PageContainer } from '@/components/layout'
import { ManagementCell, ManagementList } from '@/components/management'
import { SECONDARY_PAGES } from '@/constants/routes'
import { navigateTo } from '@/utils/router'

import styles from './index.module.scss'

export default function SecurityPage() {
  return (
    <PageContainer>
      <View className={styles.page}>
        <ManagementList>
          <ManagementCell
            glyph="lock"
            title="修改密码"
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profilePassword}`)}
          />
          <ManagementCell
            glyph="fileText"
            title="登录日志"
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profileLoginLog}`)}
          />
        </ManagementList>
      </View>
    </PageContainer>
  )
}
