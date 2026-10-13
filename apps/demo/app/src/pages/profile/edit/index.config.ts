export default definePageConfig({
  navigationBarTitleText: '个人资料',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
