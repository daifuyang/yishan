import { View } from '@tarojs/components'

import { EmptyState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function MessagesPage() {
  return (
    <PageContainer>
      <View className="gutter">
        <EmptyState text="消息中心待接入" hint="系统通知和业务提醒将在接入后展示" />
      </View>
    </PageContainer>
  )
}
