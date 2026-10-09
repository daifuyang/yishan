import type { UserConfigExport } from '@tarojs/cli'
import { resolveApiTarget } from '@yishan/demo-config'
import path from 'node:path'

const APP_ROOT = path.resolve(__dirname, '..')
const apiTarget = resolveApiTarget('http://localhost:3100')

export default {
  mini: {},
  h5: {
    devServer: {
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
