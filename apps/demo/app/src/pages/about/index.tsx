import { View, Text } from '@tarojs/components'

import { AppText } from '@/components/atoms'
import { PageContainer } from '@/components/layout'
import { APP_NAME, APP_VERSION } from '@/constants'

export default function AboutPage() {
  return (
    <PageContainer>
      <View className="gutter" style={{ textAlign: 'center', paddingTop: '56px' }}>
        <Text style={{ fontSize: '48px', lineHeight: 1 }}>⛰</Text>
        <View style={{ marginTop: '16px' }}>
          <AppText size={24} weight="semibold">
            {APP_NAME}
          </AppText>
        </View>
        <AppText size={13} variant="tertiary">
          简单可依赖的后台基座
        </AppText>
        <View style={{ marginTop: '48px' }}>
          <AppText size={13} variant="tertiary">
            版本 {APP_VERSION}
          </AppText>
        </View>
      </View>
    </PageContainer>
  )
}
