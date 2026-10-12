export default definePageConfig({
  navigationBarTitleText: '菜单表单',
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
