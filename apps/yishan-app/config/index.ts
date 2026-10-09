import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import { API_TARGET } from '@yishan/shared-config'
import path from 'node:path'

import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig(async (merge, _env) => {
  const outputRoot = `dist/${process.env.TARO_ENV || 'weapp'}`
  const apiBaseUrl =
    process.env.YISHAN_APP_API_BASE_URL ?? (process.env.TARO_ENV === 'h5' ? '' : API_TARGET)
  if (apiBaseUrl && !/^https?:\/\//.test(apiBaseUrl))
    throw new Error('YISHAN_APP_API_BASE_URL must be an absolute HTTP(S) URL')
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'yishan-app',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2 / 1,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot,
    defineConstants: { __YISHAN_API_BASE_URL__: JSON.stringify(apiBaseUrl.replace(/\/$/, '')) },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: { enable: false },
    },
    plugins: ['@tarojs/plugin-html'],
    alias: {
      '@/components': path.resolve(__dirname, '../src/components'),
      '@/constants': path.resolve(__dirname, '../src/constants'),
      '@/utils': path.resolve(__dirname, '../src/utils'),
      '@/styles': path.resolve(__dirname, '../src/styles'),
      '@/assets': path.resolve(__dirname, '../src/assets'),
      '@/stores': path.resolve(__dirname, '../src/stores'),
      '@/api': path.resolve(__dirname, '../src/api'),
      '@/hooks': path.resolve(__dirname, '../src/hooks'),
      '@/modules': path.resolve(__dirname, '../src/modules'),
      '@': path.resolve(__dirname, '../src'),
    },
    copy: {
      patterns: [
        {
          from: 'src/styles/fonts-subset/',
          to: `${outputRoot}/styles/fonts-subset/`,
          ignore: ['**/README.md'],
        },
        {
          from: 'src/assets/tabbar/',
          to: `${outputRoot}/assets/tabbar/`,
          ignore: ['**/README.md'],
        },
      ],
      options: {},
    },
    cache: { enable: true },
    mini: {
      miniCssExtractPluginOption: { ignoreOrder: true },
      postcss: {
        pxtransform: {
          enable: true,
          config: { selectorBlackList: ['nut-'] },
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      useHtmlComponents: true,
      devServer: {
        host: '0.0.0.0',
        port: 21003,
        // allowedHosts: 'all' 让 webpack-dev-server 接受非 localhost 的 Host
        // （如通过 debug.daifuyang.com 反代访问）
        allowedHosts: 'all',
        // 代理：仅当 dev 端用户直连访问时使用。
        // 注意：若通过反向代理（如 nginx）访问 /api，
        // 请在外层 nginx 中配置 /api → API_TARGET 转发。
        proxy: [
          {
            context: ['/api'],
            target: API_TARGET,
            changeOrigin: true,
            secure: false,
          },
        ],
      },
      postcss: {
        autoprefixer: { enable: true },
        pxtransform: {
          enable: true,
          config: {
            baseFontSize: 20,
            maxRootSize: 40,
            minRootSize: 20,
            unitPrecision: 5,
            propList: ['*'],
            selectorBlackList: ['body'],
            replace: true,
            mediaQuery: false,
            minPixelValue: 0,
          },
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
