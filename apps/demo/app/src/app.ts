import './styles/fonts-subset/icons.css'
import './app.scss'

import { useLaunch } from '@tarojs/taro'

import { useAuthStore, setupAuthInterceptor } from './stores/auth'

function App(props: { children?: React.ReactNode }) {
  // 注册 401 拦截
  setupAuthInterceptor()

  useLaunch(async () => {
    // 启动拉取当前用户（未登录会保持 null）
    await useAuthStore.getState().bootstrap()
  })

  return props.children
}

export default App
