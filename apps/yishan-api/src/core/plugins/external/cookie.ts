import fp from 'fastify-plugin'
import fastifyCookie, { FastifyCookieOptions } from '@fastify/cookie'

/**
 * 注册 @fastify/cookie 插件。
 *
 * 认证 cookie（yishan_at / yishan_rt）内容本身就是已由 JWT 自签名校验的令牌，
 * cookie 只作为浏览器场景下的容器，因此这里不启用 cookie 层面的 signed。
 */
export default fp<FastifyCookieOptions>(async (fastify) => {
  await fastify.register(fastifyCookie, {})
}, {
  name: 'cookie'
})
