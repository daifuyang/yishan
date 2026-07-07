import { TAB_BAR } from './constants'

/**
 * API 基础地址
 * - development: 留空（同源），由外层反向代理（nginx）转发 /api 到 API 服务
 *   或者直连 dev server 时，由 dev server 的 devServer.proxy 转发
 * - production: 实际 API 网关地址
 *
 * 注意：只能用 process.env.NODE_ENV（Taro webpack DefinePlugin 会替换），
 * 不要用自定义 env 变量，否则会进 bundle 引发 "process is not defined"
 */
export const API_BASE_URL = process.env.NODE_ENV === 'development' ? '' : 'https://api.example.com'

export const API_PREFIX = '/api/modules'

/** 移动端通道前缀（core app channel） */
export const APP_API_PREFIX = '/api/v1/app'

export const APP_NAME = '移山'

export { TAB_BAR }
