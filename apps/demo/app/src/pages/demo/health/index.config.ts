export default definePageConfig({
  navigationBarTitleText: '健康检查',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
  enablePullDownRefresh: true,
})
