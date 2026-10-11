export default definePageConfig({ navigationBarTitleText: '我的登录记录', navigationStyle: process.env.TARO_ENV === 'h5' ? 'custom' : 'default', enablePullDownRefresh: true })
