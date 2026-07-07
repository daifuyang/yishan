/**
 * 路由辅助：401 跳登录、TAB 切换
 */
import Taro from '@tarojs/taro'

import { LOGIN_PATH } from '../constants/routes'

const LOGIN_URL = `/pages/${LOGIN_PATH}`

let redirecting = false

/**
 * 跳到登录页（用于 401 / 未登录拦截）
 * 防抖：避免多次并发 401 反复 push
 */
export function redirectToLogin() {
  if (redirecting) return
  redirecting = true
  try {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    if (current && `/${current.route}` === LOGIN_URL) {
      return
    }
    Taro.redirectTo({ url: LOGIN_URL })
  } finally {
    setTimeout(() => {
      redirecting = false
    }, 500)
  }
}

export function navigateTo(path: string) {
  Taro.navigateTo({ url: path.startsWith('/') ? path : `/${path}` })
}

export function navigateBack(delta = 1) {
  Taro.navigateBack({ delta })
}

export function switchTab(path: string) {
  Taro.switchTab({ url: path.startsWith('/') ? path : `/${path}` })
}
