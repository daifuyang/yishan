import { View } from '@tarojs/components'
import { navigateTo } from '@tarojs/taro'
import { AppText } from '@/components/atoms'
import { TabBar } from '@/components/organisms'
import { CRM_ACTION_PAGE, TAB_PAGES } from '@/constants/routes'
import { CRM_WORKBENCH_ACTIONS } from '@/constants/crm-workbench'

export default function CustomersPage() {
  return (
    <View className="page-container" style={{ padding: '32rpx 24rpx 140rpx' }}>
      <AppText size={20} weight="semibold">客户</AppText>
      <View style={{ marginTop: '24rpx', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20rpx' }}>
        {CRM_WORKBENCH_ACTIONS.slice(0, 3).map((action) => (
          <View key={action.key} className="card" onClick={() => navigateTo({ url: `/${CRM_ACTION_PAGE}?action=${action.key}` })}>
            <AppText size={16} weight="medium">{action.label}</AppText>
          </View>
        ))}
      </View>
      <TabBar currentPath={TAB_PAGES.customers} />
    </View>
  )
}
