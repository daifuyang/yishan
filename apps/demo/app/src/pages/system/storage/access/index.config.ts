export default definePageConfig({
  navigationBarTitleText: '访问配置',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
