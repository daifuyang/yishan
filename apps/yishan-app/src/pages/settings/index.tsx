import { useState } from 'react'
import { Switch, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { AppText } from '@/components/atoms'
import { ListItem } from '@/components/molecules'
import { PageContainer } from '@/components/layout'
import { SECONDARY_PAGES } from '@/constants/routes'
import { navigateTo } from '@/utils/router'
import { storage } from '@/utils/storage'
import { PREFERENCE_KEYS } from '@/constants'

export default function SettingsPage() {
  const [showLoginActivity, setShowLoginActivity] = useState(
    storage.get<boolean>(PREFERENCE_KEYS.showLoginActivity, true) ?? true,
  )

  const handleActivityChange = (enabled: boolean) => {
    setShowLoginActivity(enabled)
    storage.set(PREFERENCE_KEYS.showLoginActivity, enabled)
    Taro.showToast({ title: enabled ? '已显示活动' : '已隐藏活动', icon: 'none' })
  }

  return (
    <PageContainer>
      <View className="gutter">
        <View style={{ margin: '16px 0 8px' }}>
          <AppText size={13} variant="tertiary">
            账户
          </AppText>
        </View>
        <View className="bg-surface rounded-lg" style={{ overflow: 'hidden' }}>
          <ListItem
            title="安全中心"
            showArrow
            onClick={() => navigateTo(`/${SECONDARY_PAGES.security}`)}
            bordered
          />
          <ListItem
            title="修改密码"
            showArrow
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profilePassword}`)}
            bordered
          />
          <ListItem
            title="登录日志"
            showArrow
            onClick={() => navigateTo(`/${SECONDARY_PAGES.profileLoginLog}`)}
          />
        </View>

        <View style={{ margin: '24px 0 8px' }}>
          <AppText size={13} variant="tertiary">
            偏好
          </AppText>
        </View>
        <View className="bg-surface rounded-lg flex items-center justify-between p-4">
          <AppText size={15}>首页登录活动</AppText>
          <Switch
            checked={showLoginActivity}
            onChange={(event) => handleActivityChange(event.detail.value)}
            color="#1677FF"
          />
        </View>
      </View>
    </PageContainer>
  )
}
