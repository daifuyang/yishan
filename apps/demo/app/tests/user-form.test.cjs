const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')
const { validateUserForm } = loadTs('src/pages/system/user/edit/model.ts')
const readSource = (rel) => require("node:fs").readFileSync(require("node:path").resolve(__dirname, `../${rel}`), "utf8");
const base = { username: '', phone: '13800138000', email: '', password: 'Pass123', birthDate: '' }

test('user form follows optional username and password contract without requiring extra business data', () => {
  assert.deepEqual(validateUserForm(base, false), {})
  assert.deepEqual(validateUserForm({ ...base, password: '' }, true), {})
  assert.match(validateUserForm({ ...base, password: '' }, false).password, /密码/)
  assert.match(validateUserForm({ ...base, password: '123456' }, true).password, /字母/)
  assert.match(validateUserForm({ ...base, email: 'bad' }, false).email, /邮箱/)
  assert.match(validateUserForm({ ...base, birthDate: '2026-02-30' }, true).birthDate, /出生日期/)
})

const contract = loadTs('src/pages/system/user/profileSections.ts')
const { STATUS_OPTIONS, GENDER_OPTIONS } = contract

test('契约里状态与性别的枚举值与后端取值一致', () => {
  assert.equal(STATUS_OPTIONS[0], '禁用')
  assert.equal(STATUS_OPTIONS[1], '启用')
  assert.equal(STATUS_OPTIONS[2], '锁定')
  assert.equal(GENDER_OPTIONS[0], '保密')
  assert.equal(GENDER_OPTIONS[1], '男')
  assert.equal(GENDER_OPTIONS[2], '女')
})

test('新建用户时密码可编辑，否则无法创建带密码的账号', () => {
  const opts = {
    user: { username: 'x', password: '' },
    deptNames: new Map(),
    roleNames: new Map(),
    canReadDepts: true,
    canReadRoles: true,
  }
  const create = contract.buildProfileSections({ ...opts, isCreate: true })
  const edit = contract.buildProfileSections({ ...opts, isCreate: false })
  const field = (sections) => sections.flatMap((s) => s.fields).find((f) => f.key === 'password')
  assert.equal(field(create).editable, true)
  assert.equal(field(edit).editable, false)
})

test('登录方式在任何模式下都只读', () => {
  const opts = {
    user: {},
    deptNames: new Map(),
    roleNames: new Map(),
    canReadDepts: true,
    canReadRoles: true,
  }
  const field = (isCreate) =>
    contract
      .buildProfileSections({ ...opts, isCreate })
      .flatMap((s) => s.fields)
      .find((f) => f.key === 'loginMethod')
  assert.equal(field(true).editable, false)
  assert.equal(field(false).editable, false)
})

test('编辑页不再使用平铺 Tag 承载部门与角色', () => {
  const source = readSource('src/pages/system/user/edit/index.tsx')
  assert.ok(!source.includes('toggleDept'), '编辑页不应再直接调用 toggleDept')
  assert.ok(!source.includes('toggleRole'), '编辑页不应再直接调用 toggleRole')
})

test('编辑页不再使用 showActionSheet 做性别与状态选择', () => {
  const source = readSource('src/pages/system/user/edit/index.tsx')
  assert.ok(!source.includes('showActionSheet'), '性别与状态应改用 SegmentField')
})

test('编辑页使用 OrganizationPicker 承载组织关系', () => {
  assert.ok(readSource('src/pages/system/user/edit/index.tsx').includes('OrganizationPicker'))
})

test('edit/constants.ts 不再导出与实际取值顺序相反的 options', () => {
  const source = readSource('src/pages/system/user/edit/constants.ts')
  assert.ok(!source.includes('STATUS_OPTIONS'), '选项来源应收敛到 profileSections')
  assert.ok(!source.includes('GENDER_OPTIONS'))
})
