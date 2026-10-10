import type { UserConfigExport } from '@tarojs/cli'
import { resolveApiTarget } from '@yishan/demo-config'
import path from 'node:path'

const APP_ROOT = path.resolve(__dirname, '..')
const apiTarget = resolveApiTarget('http://localhost:3100')
const extraHosts = process.env.NODE_ENV === 'development'
  ? (process.env.YISHAN_H5_ALLOWED_HOSTS ?? '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean)
  : []
for (const host of extraHosts) {
  // webpack-dev-server treats "all" and leading dots as special allowlist rules.
  if (['all', 'auto'].includes(host) || host.startsWith('.') || !/^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:]+\])$/.test(host)) {
    throw new Error('YISHAN_H5_ALLOWED_HOSTS must contain comma-separated hostnames without wildcards, schemes, paths or ports')
  }
}

export default {
  mini: {},
  h5: {
    devServer: {
      host: process.env.YISHAN_H5_HOST?.trim() || '127.0.0.1',
      port: 21003,
      allowedHosts: [...new Set(['localhost', '127.0.0.1', '[::1]', 'debug.daifuyang.com', ...extraHosts])],
      // An outer reverse proxy may route /api itself; direct development requests use this proxy.
      proxy: [
        {
          context: ['/api'],
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      ],
    },
    webpackChain(chain) {
      chain.resolve.modules.add('node_modules').prepend(path.join(APP_ROOT, 'node_modules'))
      chain.resolve.alias.set('@', path.join(APP_ROOT, 'src'))

      chain.optimization.splitChunks({
        chunks: 'all',
        minSize: 0,
        maxSize: 244000,
        minChunks: 1,
        maxInitialRequests: 20,
        maxAsyncRequests: 20,
        cacheGroups: {
          default: false,
          defaultVendors: false,
          taro: {
            name: 'taro',
            test: /[\\/]node_modules[\\/](@tarojs)[\\/]/,
            priority: 50,
          },
          react: {
            name: 'react',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            priority: 40,
          },
          vendors: {
            name: 'vendors',
            test: /[\\/]node_modules[\\/]/,
            priority: 20,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: 10,
          },
        },
      })

      chain.optimization.runtimeChunk('single')
    },
  },
} satisfies UserConfigExport<'webpack5'>
