import { View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { AppText } from '@/components/atoms'
import { CRM_WORKBENCH_ACTIONS } from '@/constants/crm-workbench'

export default function CrmActionPage() {
  const router = useRouter()
  const action = CRM_WORKBENCH_ACTIONS.find((item) => item.key === router.params.action)
  return (
    <View className="page-container" style={{ padding: '32rpx 24rpx' }}>
      <AppText size={20} weight="semibold">{action?.label ?? 'CRM'}</AppText>
      <View style={{ marginTop: '24rpx' }}><AppText variant="tertiary">移动端支持查看和处理待办，完整维护请使用管理端。</AppText></View>
    </View>
  )
}
