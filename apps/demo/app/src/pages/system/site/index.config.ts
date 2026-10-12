export default definePageConfig({
  navigationBarTitleText: '站点配置',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
