import Taro from '@tarojs/taro'
import { hooks } from '@tarojs/runtime'
import { themeStyle, themeTokens, type ThemeController } from '@yishan/ui/mobile/theme'

interface ThemePage {
  setData(data: { yishanThemeStyle: string; yishanSafeTop: number; yishanSafeBottom: number }): void
}
interface PageLifecycle {
  onLoad?: (this: ThemePage, ...args: unknown[]) => unknown
  onShow?: (this: ThemePage, ...args: unknown[]) => unknown
  onUnload?: (this: ThemePage, ...args: unknown[]) => unknown
}

const pages = new Set<ThemePage>()
let installed = false

function syncPage(page: ThemePage, controller: ThemeController) {
  let top = 0
  let bottom = 0
  try {
    const info = Taro.getWindowInfo()
    top = Math.max(0, info.safeArea?.top ?? 0)
    bottom = Math.max(0, info.screenHeight - (info.safeArea?.bottom ?? info.screenHeight))
  } catch {
    /* Older hosts fall back to zero insets. */
  }
  page.setData({
    yishanThemeStyle: themeStyle(controller.getSnapshot().resolved),
    yishanSafeTop: top,
    yishanSafeBottom: bottom,
  })
}

function syncNative(controller: ThemeController) {
  const mode = controller.getSnapshot().resolved
  const colors = themeTokens[mode]
  // These APIs can be absent on other hosts, and setTabBarStyle is rejected on non-tab pages.
  void Taro.setNavigationBarColor?.({
    frontColor: colors['color-native-navigation-front'],
    backgroundColor: colors['color-bg-surface'],
  }).catch(() => {})
  void Taro.setBackgroundColor?.({ backgroundColor: colors['color-bg-base'] }).catch(() => {})
  void Taro.setBackgroundTextStyle?.({ textStyle: mode === 'dark' ? 'light' : 'dark' }).catch(
    () => {},
  )
  void Taro.setTabBarStyle?.({
    color: colors['color-text-tertiary'],
    selectedColor: colors['color-primary'],
    backgroundColor: colors['color-bg-surface'],
    borderStyle: mode === 'dark' ? 'black' : 'white',
  }).catch(() => {})
}

export function installThemePages(controller: ThemeController) {
  if (installed || process.env.TARO_ENV === 'h5') return
  installed = true
  hooks.tap('modifyPageObject', (config: PageLifecycle) => {
    const load = config.onLoad
    const show = config.onShow
    const unload = config.onUnload
    config.onLoad = function (...args) {
      pages.add(this)
      syncPage(this, controller)
      return load?.apply(this, args)
    }
    config.onShow = function (...args) {
      syncPage(this, controller)
      syncNative(controller)
      return show?.apply(this, args)
    }
    config.onUnload = function (...args) {
      pages.delete(this)
      return unload?.apply(this, args)
    }
  })
}

export function applyAppTheme(controller: ThemeController) {
  if (process.env.TARO_ENV === 'h5') {
    document.documentElement.dataset.theme = controller.getSnapshot().resolved
    document.documentElement.dataset.themeMode = controller.getSnapshot().mode
  } else {
    pages.forEach((page) => {
      syncPage(page, controller)
    })
    syncNative(controller)
  }
}
