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

test("编辑页进入选择页时带上当前已选，否则确认会清空部门与角色", () => {
  const source = readSource('src/pages/system/user/edit/index.tsx')
  assert.ok(
    /navigateTo\(`\/\$\{page\}[^`]*ids=/.test(source),
    "编辑页跳转选择页必须携带 ?ids=，否则选择页初始选中为空且确定会写回空数组",
  )
})

test("契约不携带无数据来源的登录方式字段", () => {
  const { buildProfileSections } = contract
  const sections = buildProfileSections({
    user: {},
    deptNames: new Map(),
    roleNames: new Map(),
    canReadDepts: true,
    canReadRoles: true,
  })
  const fields = sections.flatMap((s) => s.fields)
  assert.equal(fields.find((f) => f.key === 'loginMethod'), undefined)
})


test("两个选择页登记显式读取权限，而不是借用 editUser 的增删改判定", () => {
  const source = readSource('src/modules/registry.ts')
  assert.ok(
    /'pages\/system\/user\/departments\/index': \{ moduleId: 'system-user', permissions: \['system:department:list'\] \}/.test(source),
    "部门选择页需声明 system:department:list，否则只读浏览会被要求 user:update",
  )
  assert.ok(
    /'pages\/system\/user\/roles\/index': \{ moduleId: 'system-user', permissions: \['system:role:list'\] \}/.test(source),
    "角色选择页需声明 system:role:list",
  )
})

test('密码字段在契约里始终是可填原值，留空由后端跳过', () => {
  const field = contract
    .buildProfileSections({
      user: {},
      deptNames: new Map(),
      roleNames: new Map(),
      canReadDepts: true,
      canReadRoles: true,
    })
    .flatMap((s) => s.fields)
    .find((f) => f.key === 'password');
  assert.equal(field.kind, 'secret');
  assert.equal(field.value, '');
});

test('编辑页的密码输入框留空即不修改，不带 required 标记', () => {
  const source = readSource('src/pages/system/user/edit/index.tsx');
  assert.ok(source.includes("placeholder={isEdit ? '留空则不修改'"), '编辑态密码应提示留空不修改');
  assert.ok(source.includes('required={!isEdit}'), '仅新建态把密码标为必填');
});

test('提交时空密码不会进入 update payload', () => {
  const source = readSource('src/pages/system/user/edit/hooks/useUserEditForm.ts');
  assert.ok(
    source.includes('if (password) payload.password = password'),
    '空密码必须被排除，否则会把用户密码清空',
  );
});
