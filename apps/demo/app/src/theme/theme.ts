import Taro from '@tarojs/taro'
import {
  createThemeController,
  themeTokens,
  type ResolvedTheme,
  type SemanticColor,
} from '@yishan/ui/mobile/theme'

export const THEME_STORAGE_KEY = 'yishan:app:theme'

function systemTheme(): ResolvedTheme {
  try {
    if (process.env.TARO_ENV === 'h5')
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    return Taro.getAppBaseInfo?.().theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const appTheme = createThemeController({
  storage: {
    get: () => Taro.getStorageSync(THEME_STORAGE_KEY),
    set: (mode) => Taro.setStorageSync(THEME_STORAGE_KEY, mode),
  },
  getSystemTheme: systemTheme,
  watchSystemTheme: (listener) => {
    if (process.env.TARO_ENV === 'h5') {
      const query = window.matchMedia?.('(prefers-color-scheme: dark)')
      const change = () => listener(query?.matches ? 'dark' : 'light')
      if (query?.addEventListener) {
        query.addEventListener('change', change)
        return () => query.removeEventListener('change', change)
      }
      query?.addListener?.(change)
      return () => query?.removeListener?.(change)
    }
    const change = ({ theme }: { theme: ResolvedTheme }) => listener(theme)
    Taro.onThemeChange?.(change)
    return () => Taro.offThemeChange?.(change)
  },
})

export function semanticColor(token: SemanticColor): string {
  return themeTokens[appTheme.getSnapshot().resolved][token]
}

// WeChat owns its modal surface and follows the OS even when the App mode is overridden.
export function nativeModalColor(value: string | undefined, fallback: SemanticColor): string {
  const colors =
    themeTokens[process.env.TARO_ENV === 'weapp' ? systemTheme() : appTheme.getSnapshot().resolved]
  const token = value?.match(/^var\(--(color-[\w-]+)\)$/)?.[1]
  if (token && token in colors) return colors[token as SemanticColor]
  return value ?? colors[fallback]
}
