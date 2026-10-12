const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const { isPickerCancel } = loadTs('src/utils/picker.ts')

test('errMsg 含 cancel 视为用户取消', () => {
  assert.equal(isPickerCancel({ errMsg: 'chooseImage:fail cancel' }), true)
})

test('其他 errMsg 不是取消', () => {
  assert.equal(isPickerCancel({ errMsg: 'chooseImage:fail auth deny' }), false)
  assert.equal(isPickerCancel({ message: 'cancel' }), false)
})

test('非对象输入不是取消', () => {
  for (const reason of [undefined, null, 'cancel', 0, new Error('cancel')])
    assert.equal(isPickerCancel(reason), false)
})
