export default definePageConfig({
  navigationBarTitleText: '菜单详情',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
