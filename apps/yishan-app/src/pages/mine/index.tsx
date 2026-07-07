import { View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import { MineProfile, TabBar, type MineMenuItem } from '@/components/organisms'
import { useAuthStore } from '@/stores/auth'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { TAB_PAGES, SECONDARY_PAGES } from '@/constants/routes'
import { ICONS } from '@/components/icons/icons'

export default function MinePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  useRequireAuth()
  useDidShow(() => {
    useAuthStore.getState().refreshMe()
  })

  const username = user?.realName || user?.username || '未登录'
  const bio =
    user?.email || (user?.phone ? `手机号 ${user.phone}` : '未设置简介')

  const isAdmin = user?.roleIds && user.roleIds.length > 0

  const handleItem = (key: string) => {
    if (key === 'profile') {
      navigateTo(`/${SECONDARY_PAGES.profileEdit}`)
    } else if (key === 'password') {
      navigateTo(`/${SECONDARY_PAGES.profilePassword}`)
    } else if (key === 'loginLog') {
      navigateTo(`/${SECONDARY_PAGES.profileLoginLog}`)
    } else if (key === 'system') {
      navigateTo('/pages/system/user/index')
    } else if (key === 'logout') {
      Taro.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: async (res) => {
          if (res.confirm) {
            await logout()
            Taro.reLaunch({ url: '/pages/login/index' })
          }
        },
      })
    }
  }

  const menus: MineMenuItem[] = [
    { key: 'profile', icon: ICONS.user, title: '个人资料' },
    { key: 'password', icon: ICONS.settings, title: '修改密码' },
    { key: 'loginLog', icon: ICONS.document, title: '登录日志' },
    ...(isAdmin ? [{ key: 'system' as const, icon: ICONS.apps, title: '系统管理' }] : []),
    { key: 'logout', icon: ICONS.logout, title: '退出登录' },
  ]

  return (
    <View className="page-container">
      <MineProfile
        username={username}
        avatar={user?.avatar}
        bio={bio}
        showStats={false}
        menus={menus}
        onItemClick={handleItem}
      />
      <TabBar currentPath={TAB_PAGES.mine} />
    </View>
  )
}
