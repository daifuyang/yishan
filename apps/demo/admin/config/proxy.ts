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
 * Demo 默认 API 地址属于产品配置。API_TARGET / YISHAN_API_TARGET 覆盖
 * 完整地址，YISHAN_API_PORT 仅覆盖默认地址的端口。dev server 使用 PORT。
 */
import { resolveApiTarget } from '@yishan/shared-config';

const apiTarget = resolveApiTarget('http://localhost:3100');

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
