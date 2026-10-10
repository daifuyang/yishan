import Taro from '@tarojs/taro'

import { TAB_BAR } from '../constants'
import { LOGIN_PATH, SECONDARY_PAGES, SYSTEM_PAGES, TAB_PAGES } from '../constants/routes'

const loginUrl = `/pages/${LOGIN_PATH}`
const homeUrl = `/${TAB_PAGES.home}`
const tabs = new Set<string>(TAB_BAR.list.map((item) => `/${item.pagePath}`))
const secondaryPaths = new Set<string>(
  [...Object.values(SECONDARY_PAGES), ...Object.values(SYSTEM_PAGES)].map((page) => `/${page}`),
)
let redirectFlight: Promise<unknown> | undefined
let returnUrl: string | undefined

function normalize(path: string) {
  return `/${path.replace(/^\/+/, '')}`
}

export function redirectToLogin(rememberDestination = true): Promise<unknown> {
  if (redirectFlight) return redirectFlight
  const pages = Taro.getCurrentPages()
  const current = pages[pages.length - 1]
  const path = normalize(current?.route ?? '')
  if (!rememberDestination) returnUrl = undefined
  else if (secondaryPaths.has(path)) {
    const options = current?.options ?? {}
    const query = Object.entries(options)
      .filter(([key]) => !key.startsWith('$'))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&')
    returnUrl = `${path}${query ? `?${query}` : ''}`
  }
  if (path === loginUrl) return Promise.resolve()
  const flight = Taro.reLaunch({ url: loginUrl })
  redirectFlight = flight
  void flight
    .finally(() => {
      if (redirectFlight === flight) redirectFlight = undefined
    })
    .catch(() => {})
  return flight
}

export async function resumeAfterLogin() {
  const destination = returnUrl
  returnUrl = undefined
  await Taro.reLaunch({ url: homeUrl })
  if (destination && secondaryPaths.has(destination.split('?')[0])) {
    // Taro H5 resolves reLaunch before its page transition has finished.
    // Wait for the home route before mounting a secondary destination.
    const timeoutAt = Date.now() + 1000
    while (Date.now() < timeoutAt) {
      const pages = Taro.getCurrentPages()
      if (pages[pages.length - 1]?.route === TAB_PAGES.home) break
      await new Promise((resolve) => setTimeout(resolve, 16))
    }
    await Taro.navigateTo({ url: destination })
  }
}

export function navigateTo(path: string) {
  const url = normalize(path)
  if (tabs.has(url.split('?')[0])) return switchTab(url.split('?')[0])
  return Taro.navigateTo({ url })
}

export function navigateBack(delta = 1) {
  const pages = Taro.getCurrentPages()
  if (pages.length <= delta) return Taro.reLaunch({ url: homeUrl })
  return Taro.navigateBack({ delta })
}

export function switchTab(path: string) {
  const url = normalize(path).split('?')[0]
  return Taro.switchTab({ url })
}
