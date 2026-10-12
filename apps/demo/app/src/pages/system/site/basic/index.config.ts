export default definePageConfig({
  navigationBarTitleText: '基础信息',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
