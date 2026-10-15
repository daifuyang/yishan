import { View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useRef } from 'react'

import { PageContainer } from '@/components/layout'
import { ManagementCell, ManagementList } from '@/components/management'
import { UserHeader } from '@/components/organisms'
import { APP_NAME } from '@/constants'
import { SECONDARY_PAGES } from '@/constants/routes'
import { confirmAction } from '@/hooks'
import { useAuthStore } from '@/stores/auth'
import { navigateTo, redirectToLogin } from '@/utils/router'

import styles from './index.module.scss'

export default function MinePage() {
  const user = useAuthStore((state) => state.user)
  const loggingOut = useRef(false)

  useDidShow(() => {
    const auth = useAuthStore.getState()
    if (auth.bootstrapped && auth.token && auth.user) void auth.refreshMe()
  })

  const open = (route: string) => () => navigateTo(`/${route}`)

  const handleLogout = async () => {
    if (loggingOut.current) return
    loggingOut.current = true
    try {
      if (
        await confirmAction({
          title: '退出登录',
          content: '确定要退出当前账号吗？',
          confirmText: '退出',
        })
      ) {
        await useAuthStore.getState().logout()
        await redirectToLogin(false)
      }
    } finally {
      loggingOut.current = false
    }
  }

  return (
    <PageContainer>
      <View className={styles.page}>
        <UserHeader
          loading={!user}
          name={user?.realName || user?.nickname || user?.username || ''}
          account={user?.email || user?.phone || user?.username}
          avatar={user?.avatar}
        />

        <ManagementList>
          <ManagementCell
            size="compact"
            glyph="pencil"
            title="个人资料"
            onClick={open(SECONDARY_PAGES.profileEdit)}
          />
          <ManagementCell size="compact" glyph="shield" title="账户安全" onClick={open(SECONDARY_PAGES.security)} />
          <ManagementCell size="compact" glyph="fileText" title="消息中心" onClick={open(SECONDARY_PAGES.messages)} />
          <ManagementCell
            size="compact"
            glyph="building"
            title={`关于${APP_NAME}`}
            onClick={open(SECONDARY_PAGES.about)}
          />
          <ManagementCell
            size="compact"
            glyph="upload"
            title="退出登录"
            showArrow={false}
            bordered={false}
            onClick={handleLogout}
          />
        </ManagementList>
      </View>
    </PageContainer>
  )
}
