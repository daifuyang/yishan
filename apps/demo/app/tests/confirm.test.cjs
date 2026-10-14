const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('confirmation supplies valid native colors on both platforms and returns cancellation', async () => {
  let options
  const { confirmAction } = loadTs('src/hooks/useConfirm.ts', {
    '@tarojs/taro': {
      showModal: async (value) => {
        options = value
        if (typeof value.cancelColor !== 'string') throw new Error('invalid native color')
        return { confirm: false }
      },
    },
  })
  assert.equal(await confirmAction({ content: '退出当前账号？' }), false)
  assert.equal(options.confirmText, '确定')
})

test('WeChat native modal text follows host appearance when app mode is overridden', async () => {
  const previous = process.env.TARO_ENV
  process.env.TARO_ENV = 'weapp'
  try {
    let options
    let system = 'light'
    const taro = {
      getAppBaseInfo: () => ({ theme: system }),
      setStorageSync() {},
      showModal: async (value) => {
        options = value
        return { confirm: false }
      },
    }
    const theme = loadTs('src/theme/theme.ts', { '@tarojs/taro': taro })
    const { confirmAction } = loadTs('src/hooks/useConfirm.ts', {
      '@tarojs/taro': taro,
      '@/theme/theme': theme,
    })
    theme.appTheme.setMode('dark')
    await confirmAction({ content: '取消测试' })
    assert.equal(options.cancelColor, '#1D2129')
    system = 'dark'
    theme.appTheme.setMode('light')
    await confirmAction({ content: '取消测试' })
    assert.equal(options.cancelColor, '#F0F1F3')
  } finally {
    if (previous === undefined) delete process.env.TARO_ENV
    else process.env.TARO_ENV = previous
  }
})
