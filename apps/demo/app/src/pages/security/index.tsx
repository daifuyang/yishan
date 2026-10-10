import { View } from '@tarojs/components'

import { AppText } from '@/components/atoms'
import { ListItem } from '@/components/molecules'
import { PageContainer } from '@/components/layout'
import { SECONDARY_PAGES } from '@/constants/routes'
import { navigateTo } from '@/utils/router'

export default function SecurityPage() {
  return (
    <PageContainer>
      <View className="gutter">
        <View style={{ padding: '24px 4px 12px' }}>
          <AppText size={18} weight="semibold">
            账户安全
          </AppText>
          <AppText size={13} variant="tertiary">
            保护账号与登录凭证
          </AppText>
        </View>
        <View className="bg-surface rounded-lg" style={{ overflow: 'hidden' }}>
          <ListItem
            title="修改密码"
            value="定期更新密码"
            showArrow
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profilePassword}`)}
            bordered
          />
          <ListItem
            title="登录日志"
            value="查看近期登录"
            showArrow
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profileLoginLog}`)}
          />
        </View>
      </View>
    </PageContainer>
  )
}
