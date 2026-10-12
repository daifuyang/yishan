export default definePageConfig({
  navigationBarTitleText: '工作台菜单详情',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
