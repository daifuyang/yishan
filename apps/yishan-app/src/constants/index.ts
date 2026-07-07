export const APP_NAME = '移山'

export const TAB_BAR = {
  color: '#86909C',
  selectedColor: '#1677FF',
  backgroundColor: '#FFFFFF',
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
      text: '应用',
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
  primary: '#1677FF',
  primaryHover: '#4096FF',
  primaryPressed: '#0958D9',
  success: '#00B42A',
  warning: '#FF7D00',
  danger: '#F53F3F',
} as const
