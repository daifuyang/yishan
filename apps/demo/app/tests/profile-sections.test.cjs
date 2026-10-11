const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const {
  buildProfileSections,
  formatOrgSummary,
  maskSecret,
  UNSET,
} = loadTs('src/pages/system/user/profileSections.ts')

const USER = {
  id: 2,
  username: 'demo',
  realName: '张三',
  nickname: '三三',
  phone: '13800138000',
  email: 'a@b.com',
  gender: '1',
  birthDate: '1990-01-01',
  status: '1',
  deptIds: [48, 52],
  roleIds: [37],
}

function build(over = {}) {
  return buildProfileSections({
    user: USER,
    deptNames: new Map([[48, '研发部门'], [52, '市场部门']]),
    roleNames: new Map([[37, '管理员']]),
    canReadDepts: true,
    canReadRoles: true,
    ...over,
  })
}

function fieldOf(sections, key) {
  for (const s of sections) for (const f of s.fields) if (f.key === key) return f
  return undefined
}

test('分组顺序为 基础信息/联系方式/安全设置/组织关系/状态/其他属性', () => {
  assert.deepEqual(
    build().map((s) => s.title),
    ['基础信息', '联系方式', '安全设置', '组织关系', '状态', '其他属性'],
  )
})

test('基础信息字段顺序为 用户名/真实姓名/昵称', () => {
  assert.deepEqual(
    build()[0].fields.map((f) => f.label),
    ['用户名', '真实姓名', '昵称'],
  )
})

test('密码字段是 secret 且打码为 8 个圆点', () => {
  const f = fieldOf(build(), 'password')
  assert.equal(f.kind, 'secret')
  assert.equal(maskSecret('secret123'), '••••••••')
})

test('无权限时 org 字段整个从契约中消失而不是留空占位', () => {
  const sections = build({ canReadDepts: false })
  assert.equal(fieldOf(sections, 'depts'), undefined)
  assert.ok(fieldOf(sections, 'roles'), '角色字段应保留')
})

test('org 字段带 ids / names / target', () => {
  const f = fieldOf(build(), 'depts')
  assert.equal(f.kind, 'org')
  assert.deepEqual(f.ids, [48, 52])
  assert.equal(f.names.get(48), '研发部门')
  assert.equal(f.target, 'departments')
})

test('text 字段空值统一为 未设置', () => {
  assert.equal(fieldOf(build({ user: { ...USER, nickname: '' } }), 'nickname').value, UNSET)
})

test('enum 字段带候选集，性别三项顺序为 保密/男/女', () => {
  const f = fieldOf(build(), 'gender')
  assert.equal(f.kind, 'enum')
  assert.deepEqual(f.options, ['保密', '男', '女'])
})

test('状态 enum 顺序为 禁用/启用/锁定', () => {
  assert.deepEqual(fieldOf(build(), 'status').options, ['禁用', '启用', '锁定'])
})

test('formatOrgSummary 只显示前 2 个名称并追加 等 N 个', () => {
  const names = new Map([[1, '甲'], [2, '乙'], [3, '丙'], [4, '丁']])
  assert.equal(formatOrgSummary([1, 2, 3, 4], names), '甲、乙 等 4 个')
  assert.equal(formatOrgSummary([1, 2], names), '甲、乙')
  assert.equal(formatOrgSummary([], names), UNSET)
})

test('formatOrgSummary 在名称全部解析不出时回退为占位文案', () => {
  assert.equal(formatOrgSummary([9, 10], new Map()), '名称暂不可用')
})

test('formatOrgSummary 的「等 N 个」按实际选中数计，不把占位算作部门', () => {
  const names = new Map([[1, '甲'], [2, '乙']])
  assert.equal(formatOrgSummary([1, 2, 3, 4], names), '甲、乙 等 4 个')
})

test('formatOrgSummary 部分解析失败时保留占位文案', () => {
  const names = new Map([[1, '甲']])
  assert.equal(formatOrgSummary([1, 9], names), '甲、名称暂不可用')
})