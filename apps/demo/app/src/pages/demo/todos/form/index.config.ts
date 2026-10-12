export default definePageConfig({
  navigationBarTitleText: 'Todo 表单',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
