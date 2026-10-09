/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * -------------------------------
 * The agent cannot take effect in the production environment
 * so there is no configuration of the production environment
 * For details, please see
 * https://pro.ant.design/docs/deploy
 *
 * @doc https://umijs.org/docs/guides/proxy
 *
 * 后端 base URL 统一从 @yishan/shared-config 的 API_TARGET 读（默认
 * http://localhost:3100，与 apps/yishan-api/.env 的 PORT 对齐）。可通过
 * 环境变量 YISHAN_API_TARGET / YISHAN_API_PORT 覆盖。dev 端口由 PORT 控
 * 制，传给 max dev 的 dev server。
 */
import { API_TARGET } from '@yishan/shared-config';

const apiTarget = API_TARGET;

export default {
  // 本地开发代理配置
  dev: {
    // localhost:${PORT || 8000}/api/** -> ${apiTarget}/api/**
    '/api/': {
      // 要代理的地址
      target: apiTarget,
      // 配置了这个可以从 http 代理到 https
      // 依赖 origin 的功能可能需要这个，比如 cookie
      changeOrigin: true,
    },
    '/uploads/': {
      // 要代理的地址
      target: apiTarget,
      // 配置了这个可以从 http 代理到 https
      // 依赖 origin 的功能可能需要这个，比如 cookie
      changeOrigin: true,
    },
  },
  /**
   * @name 详细的代理配置
   * @doc https://github.com/chimurai/http-proxy-middleware
   */
  test: {
    // localhost:8000/api/** -> https://preview.pro.ant.design/api/**
    '/api/': {
      target: 'https://proapi.azurewebsites.net',
      changeOrigin: true,
      pathRewrite: { '^': '' },
    },
  },
  pre: {
    '/api/': {
      target: 'your pre url',
      changeOrigin: true,
      pathRewrite: { '^': '' },
    },
  },
};