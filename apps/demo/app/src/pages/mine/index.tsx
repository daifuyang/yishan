import { View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useRef, useState } from 'react'

import { PageContainer } from '@/components/layout'
import {
  ActionSheet,
  type ActionSheetItem,
  ManagementCell,
  ManagementList,
} from '@/components/management'
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
  const [sheetOpen, setSheetOpen] = useState(false)

  useDidShow(() => {
    const auth = useAuthStore.getState()
    if (auth.bootstrapped && auth.token && auth.user) void auth.refreshMe()
  })

  const open = (route: string) => () => navigateTo(`/${route}`)

  const handleLogout = async () => {
    if (loggingOut.current) return
    setSheetOpen(false)
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

  const sheetItems: ActionSheetItem[] = [
    // 图标沿用 shared LineIcon：它没有 logOut，用「离开盒子」的 upload 表达退出
    { key: 'logout', label: '退出登录', icon: 'upload', danger: true, onClick: () => void handleLogout() },
  ]

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
            glyph="pencil"
            title="个人资料"
            onClick={open(SECONDARY_PAGES.profileEdit)}
          />
          <ManagementCell glyph="shield" title="账户安全" onClick={open(SECONDARY_PAGES.security)} />
          <ManagementCell glyph="fileText" title="消息中心" onClick={open(SECONDARY_PAGES.messages)} />
          <ManagementCell
            glyph="building"
            title={`关于${APP_NAME}`}
            onClick={open(SECONDARY_PAGES.about)}
          />
          {/* 打开操作面板的行不画箭头：箭头表示「进入下一级」，这里只是弹出面板 */}
          <ManagementCell
            glyph="upload"
            title="退出登录"
            showArrow={false}
            bordered={false}
            onClick={() => setSheetOpen(true)}
          />
        </ManagementList>

        <ActionSheet
          open={sheetOpen}
          title="退出登录"
          items={sheetItems}
          onClose={() => setSheetOpen(false)}
        />
      </View>
    </PageContainer>
  )
}
