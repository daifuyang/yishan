import { APP_NAME, TAB_BAR } from './constants'
import { PAGE_CONFIG } from './constants/page-config'
import { themeTokens } from '@yishan/ui/mobile/theme/palette'

export default defineAppConfig({
  ...PAGE_CONFIG,
  ...(process.env.TARO_ENV === 'weapp' ? { darkmode: true, themeLocation: 'theme.json' } : {}),
  window: {
    backgroundTextStyle: process.env.TARO_ENV === 'weapp' ? '@backgroundTextStyle' : 'dark',
    navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
    navigationBarBackgroundColor: process.env.TARO_ENV === 'weapp' ? '@navigationBarBackgroundColor' : TAB_BAR.backgroundColor,
    navigationBarTitleText: APP_NAME,
    navigationBarTextStyle: process.env.TARO_ENV === 'weapp' ? '@navigationBarTextStyle' : 'black',
    backgroundColor: process.env.TARO_ENV === 'weapp' ? '@backgroundColor' : themeTokens.light['color-bg-base'],
  },
  tabBar: {
    ...TAB_BAR,
    // WeChat accepts theme references here; Taro 4.2 types still list only literal border styles.
    ...(process.env.TARO_ENV === 'weapp' ? { color: '@tabBarColor', selectedColor: '@tabBarSelectedColor', backgroundColor: '@tabBarBackgroundColor', borderStyle: '@tabBarBorderStyle' as 'white' } : {}),
    list: TAB_BAR.list.map((tab) => ({ ...tab })),
  },
})
