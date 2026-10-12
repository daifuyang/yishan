export default definePageConfig({
  navigationBarTitleText: '部门详情',
  enablePullDownRefresh: true,
  navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default',
})
