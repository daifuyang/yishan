import { Text, View } from '@tarojs/components'
import { PageContainer } from '@/components/layout'

export default function ComingSoonPage() {
  return (
    <PageContainer>
      <View style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: '600' }}>功能接入中</Text>
        <Text style={{ display: 'block', marginTop: '12px', color: '#86909c' }}>
          移动端功能正在建设中，敬请期待。
        </Text>
      </View>
    </PageContainer>
  )
}
