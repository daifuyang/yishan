export default definePageConfig({
  navigationBarTitleText: '云存储',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
