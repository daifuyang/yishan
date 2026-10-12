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
