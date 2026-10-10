import type { UserConfigExport } from '@tarojs/cli'
import path from 'node:path'

const APP_ROOT = path.resolve(__dirname, '..')

export default {
  mini: {},
  h5: {
    webpackChain(chain) {
      chain.resolve.alias.set('@', path.join(APP_ROOT, 'src'))
    },
  },
} satisfies UserConfigExport<'webpack5'>
