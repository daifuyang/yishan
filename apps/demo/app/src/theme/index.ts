import Taro from '@tarojs/taro'
import { appTheme } from './theme'
import { applyAppTheme, installThemePages as installPages } from './platform'
export { appTheme, THEME_STORAGE_KEY, semanticColor, nativeModalColor } from './theme'

export const installThemePages = () => installPages(appTheme)
export function startAppTheme() {
  const stop = appTheme.start()
  const unsubscribe = appTheme.subscribe(() => applyAppTheme(appTheme))
  const resize = () => applyAppTheme(appTheme)
  Taro.onWindowResize?.(resize)
  applyAppTheme(appTheme)
  return () => {
    unsubscribe()
    stop()
    Taro.offWindowResize?.(resize)
  }
}
