import { createMobileEnvironment } from '@yishan/core-app/env'

// 构建期注入；H5 默认同源，小程序默认复用 API_TARGET，可用公开网关覆盖。
export const environment = createMobileEnvironment({
  apiBaseUrl: __YISHAN_API_BASE_URL__,
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
})
export const API_BASE_URL = environment.apiBaseUrl
export const APP_API_PREFIX = '/api/v1/app'
export { APP_NAME, TAB_BAR } from './constants'
