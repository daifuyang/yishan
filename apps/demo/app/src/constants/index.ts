import { themeTokens } from '@yishan/ui/mobile/theme/palette'

export const APP_NAME = '移山'
export const APP_VERSION = '0.1.0'

export const TAB_BAR = {
  color: themeTokens.light['color-text-tertiary'],
  selectedColor: themeTokens.light['color-primary'],
  backgroundColor: themeTokens.light['color-bg-surface'],
  borderStyle: 'white',
  list: [
    {
      pagePath: 'pages/index/index',
      text: '首页',
      iconPath: 'assets/tabbar/home.png',
      selectedIconPath: 'assets/tabbar/home-active.png',
    },
    {
      pagePath: 'pages/apps/index',
      text: '工作台',
      iconPath: 'assets/tabbar/apps.png',
      selectedIconPath: 'assets/tabbar/apps-active.png',
    },
    {
      pagePath: 'pages/mine/index',
      text: '我的',
      iconPath: 'assets/tabbar/user.png',
      selectedIconPath: 'assets/tabbar/user-active.png',
    },
  ],
} as const

export const THEME = {
  primary: themeTokens.light['color-primary'],
  primaryHover: themeTokens.light['color-primary-hover'],
  primaryPressed: themeTokens.light['color-primary-pressed'],
  success: themeTokens.light['color-success'],
  warning: themeTokens.light['color-warning'],
  danger: themeTokens.light['color-danger'],
} as const
