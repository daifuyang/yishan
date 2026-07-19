import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import path from 'node:path'

import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig(async (merge, _env) => {
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
    outputRoot: 'dist',
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
    },
    copy: {
      patterns: [
        { from: 'src/styles/fonts-subset/', to: 'styles/fonts-subset/' },
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
      // Taro 的 webpack5 UserConfigExport' devServer 类型不直接接受 https，
      // 但 webpack-dev-server 自身支持。cast 保留显式关闭 HTTPS 的意图
      // （外层 nginx 已终止 TLS）。
      devServer: ({
        host: '0.0.0.0',
        port: 21003,
        // allowedHosts: 'all' 让 webpack-dev-server 接受非 localhost 的 Host
        // （如通过 debug.daifuyang.com 反代访问）
        allowedHosts: 'all',
        // 关闭 HTTPS 自动跳转（外层 nginx 已终止 TLS）
        https: false,
        // 代理：仅当 dev 端用户直连访问时使用。
        // 注意：若通过反向代理（如 nginx）访问 /api，
        // 请在外层 nginx 中配置 /api → 3000 转发，不要依赖此处代理。
        proxy: [
          {
            context: ['/api'],
            target: process.env.YISHAN_API_TARGET || 'http://127.0.0.1:3000',
            changeOrigin: true,
            secure: false,
          },
        ],
      }) as any,
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
