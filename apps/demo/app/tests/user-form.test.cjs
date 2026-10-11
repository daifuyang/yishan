const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')
const { validateUserForm } = loadTs('src/pages/system/user/edit/model.ts')
const base = { username: '', phone: '13800138000', email: '', password: 'Pass123', birthDate: '' }

test('user form follows optional username and password contract without requiring extra business data', () => {
  assert.deepEqual(validateUserForm(base, false), {})
  assert.deepEqual(validateUserForm({ ...base, password: '' }, true), {})
  assert.match(validateUserForm({ ...base, password: '' }, false).password, /密码/)
  assert.match(validateUserForm({ ...base, password: '123456' }, true).password, /字母/)
  assert.match(validateUserForm({ ...base, email: 'bad' }, false).email, /邮箱/)
  assert.match(validateUserForm({ ...base, birthDate: '2026-02-30' }, true).birthDate, /出生日期/)
})
