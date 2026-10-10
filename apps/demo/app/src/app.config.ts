import { APP_NAME, TAB_BAR } from './constants'
import { PAGE_CONFIG } from './constants/page-config'

export default defineAppConfig({
  ...PAGE_CONFIG,
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTitleText: APP_NAME,
    navigationBarTextStyle: 'black',
    backgroundColor: '#F7F8FA',
  },
  tabBar: { ...TAB_BAR, list: TAB_BAR.list.map((tab) => ({ ...tab })) },
})
