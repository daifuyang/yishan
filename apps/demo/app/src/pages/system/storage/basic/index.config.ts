export default definePageConfig({
  navigationBarTitleText: '基础配置',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
