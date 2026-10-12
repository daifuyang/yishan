export default definePageConfig({
  navigationBarTitleText: '备案与页脚',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
