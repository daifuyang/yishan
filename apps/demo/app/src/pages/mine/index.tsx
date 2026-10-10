import { useRef } from 'react'
import { useDidShow } from '@tarojs/taro'

import { IconFont } from '@/components/icons'
import { PageContainer } from '@/components/layout'
import { type MineMenuItem, MineProfile } from '@/components/organisms'
import { APP_NAME } from '@/constants'
import { SECONDARY_PAGES } from '@/constants/routes'
import { confirmAction } from '@/hooks'
import { useAuthStore } from '@/stores/auth'
import { navigateTo, redirectToLogin } from '@/utils/router'

export default function MinePage() {
  const user = useAuthStore((state) => state.user)
  const loggingOut = useRef(false)

  useDidShow(() => {
    const auth = useAuthStore.getState()
    if (auth.bootstrapped && auth.token && auth.user) void auth.refreshMe()
  })

  const handleItem = async (key: string) => {
    const routes: Record<string, string> = {
      profile: SECONDARY_PAGES.profileEdit,
      settings: SECONDARY_PAGES.settings,
      security: SECONDARY_PAGES.security,
      messages: SECONDARY_PAGES.messages,
      about: SECONDARY_PAGES.about,
    }
    if (routes[key]) {
      navigateTo(`/${routes[key]}`)
      return
    }
    if (key !== 'logout' || loggingOut.current) return
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

  const menus: MineMenuItem[] = [
    { key: 'profile', icon: <IconFont name="user" size={20} />, title: '个人资料' },
    { key: 'security', icon: <IconFont name="settings" size={20} />, title: '账户安全' },
    { key: 'messages', icon: <IconFont name="bell" size={20} />, title: '消息中心' },
    { key: 'settings', icon: <IconFont name="settings" size={20} />, title: '设置' },
    { key: 'about', icon: 'ⓘ', title: `关于${APP_NAME}` },
    { key: 'logout', icon: '→', title: '退出登录' },
  ]

  return (
    <PageContainer>
      <MineProfile
        username={user?.realName || user?.nickname || user?.username || ''}
        avatar={user?.avatar}
        bio={user?.email || user?.phone || '完善个人资料，方便同事联系'}
        menus={menus}
        onItemClick={(key) => void handleItem(key)}
      />
    </PageContainer>
  )
}
