export default definePageConfig({
  navigationBarTitleText: '字典项详情',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
