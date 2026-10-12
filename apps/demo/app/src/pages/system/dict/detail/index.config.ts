export default definePageConfig({
  navigationBarTitleText: '字典详情',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
