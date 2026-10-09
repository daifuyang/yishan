// 构建期注入；H5 默认同源，小程序默认复用 API_TARGET，可用公开网关覆盖。
export const API_BASE_URL = __YISHAN_API_BASE_URL__
export const APP_API_PREFIX = '/api/v1/app'
export { APP_NAME, TAB_BAR } from './constants'
