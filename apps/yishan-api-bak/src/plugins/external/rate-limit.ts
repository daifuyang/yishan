import rateLimit from '@fastify/rate-limit'

export const autoConfig = {
  max: 100, // 每个时间窗口最多100个请求
  timeWindow: '1 minute',
  allowList: ['127.0.0.1'], // 允许本地请求不受限制
  cache: 10000, // 缓存10秒
  skipOnError: true // 如果存储错误，跳过限速
}

/**
 * This plugin adds rate limiting to the application
 *
 * @see {@link https://github.com/fastify/fastify-rate-limit}
 */
export default rateLimit