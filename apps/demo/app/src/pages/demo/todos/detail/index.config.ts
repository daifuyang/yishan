export default definePageConfig({
  navigationBarTitleText: 'Todo 详情',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
