/**
 * 页面鉴权 hook：未登录时跳登录页
 * 用法：useRequireAuth()  // 放在 onLoad / useLoad
 */
import { useEffect, } from 'react'

import { useAuthStore } from '@/stores/auth'
import { redirectToLogin } from './router'

/**
 * 在页面 useLoad / useDidShow 时调用
 * 返回 bootstrapped 状态，false 表示仍在恢复会话（可显示 loading）
 */
export function useRequireAuth(): { ready: boolean; loggedIn: boolean } {
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (bootstrapped && !token) {
      redirectToLogin()
    }
  }, [bootstrapped, token])

  return { ready: bootstrapped, loggedIn: !!token }
}
