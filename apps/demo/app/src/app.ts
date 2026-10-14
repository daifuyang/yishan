import './styles/fonts-subset/icons.css'
import './app.scss'

import { useLaunch } from '@tarojs/taro'
import { createElement, useEffect } from 'react'
import { ThemeProvider } from '@yishan/ui/mobile/theme/react'
import { appTheme, installThemePages, startAppTheme } from './theme'

import { useAuthStore, setupAuthInterceptor } from './stores/auth'

installThemePages()

function App(props: { children?: React.ReactNode }) {
  // 注册 401 拦截
  setupAuthInterceptor()
  useEffect(startAppTheme, [])

  useLaunch(async () => {
    // 启动拉取当前用户（未登录会保持 null）
    await useAuthStore.getState().bootstrap()
  })

  return createElement(ThemeProvider, { controller: appTheme }, props.children)
}

export default App
