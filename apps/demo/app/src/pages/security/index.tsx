import { View } from '@tarojs/components'

import { PageContainer } from '@/components/layout'
import { ManagementList } from '@/components/management'
import { LineIcon } from '@/components/icons/LineIcon'
import { ListItem } from '@/components/molecules'
import { SECONDARY_PAGES } from '@/constants/routes'
import { navigateTo } from '@/utils/router'

import styles from './index.module.scss'

export default function SecurityPage() {
  return (
    <PageContainer>
      <View className={styles.page}>
        <ManagementList>
          <ListItem
            icon={<LineIcon name="lock" />}
            showArrow
            bordered
            title="修改密码"
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profilePassword}`)}
          />
          <ListItem
            icon={<LineIcon name="history" />}
            showArrow
            title="登录日志"
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profileLoginLog}`)}
          />
        </ManagementList>
      </View>
    </PageContainer>
  )
}
