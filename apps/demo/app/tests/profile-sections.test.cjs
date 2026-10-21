const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTs, appRoot, deferred } = require('./helpers/load-ts.cjs')

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

const pageSource = (file) => fs.readFileSync(path.join(appRoot, file), 'utf8')

const LEGACY_SETTINGS_ATOMS = /SettingCell|SettingGroup|DangerAction/

test('个人中心与账户安全复用简洁设置行和共享列表分组', () => {
  for (const file of ['src/pages/mine/index.tsx', 'src/pages/security/index.tsx']) {
    const page = pageSource(file)
    assert.doesNotMatch(page, LEGACY_SETTINGS_ATOMS, `${file} 不应再引用旧设置组件`)
    assert.match(page, /import \{ ListItem \} from '@\/components\/molecules'/)
    const shared = page.match(/import \{([^}]*)\} from '@\/components\/management'/)
    assert.ok(shared, `${file} 应从 @/components/management 引入共享原子`)
    assert.match(shared[1], /\bManagementList\b/, '设置分组用共享 ManagementList')
    assert.match(page, /<ManagementList\b/, '渲染共享 ManagementList')
    assert.match(page, /<ListItem\b/, '渲染共享设置行')
  }
})

test('账户安全列表保留现有跳转目标', () => {
  const page = pageSource('src/pages/security/index.tsx')
  assert.match(page, /SECONDARY_PAGES\.profilePassword/, '修改密码入口不变')
  assert.match(page, /SECONDARY_PAGES\.profileLoginLog/, '登录日志入口不变')
})

function mineHarness(confirm, { logout = async () => {} } = {}) {
  const actions = []
  const confirmations = []
  const states = []
  const refs = []
  let stateIndex = 0
  let refIndex = 0
  const user = { id: 1, nickname: '三三', realName: '张三', email: 'a@b.com' }
  const store = (selector) =>
    selector({
      user,
      logout: async () => {
        actions.push('logout')
      },
    })
  store.getState = () => ({
    bootstrapped: true,
    token: 'token',
    user,
    refreshMe: async () => actions.push('refresh'),
    logout: async () => {
      actions.push('logout')
      await logout()
    },
  })
  const component = loadTs('src/pages/mine/index.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [
          states[index],
          (value) => {
            states[index] = typeof value === 'function' ? value(states[index]) : value
          },
        ]
      },
      useRef(initial) {
        const index = refIndex++
        refs[index] ||= { current: initial }
        return refs[index]
      },
      useEffect: () => {},
    },
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@tarojs/taro': { useDidShow: () => {} },
    '@/components/layout': { PageContainer: 'PageContainer' },
    '@/components/organisms': { UserHeader: 'UserHeader' },
    '@/components/management': Object.fromEntries(
      ['ManagementList', 'ManagementCell', 'ActionSheet'].map((name) => [name, name]),
    ),
    '@/components/molecules': { ListItem: 'ListItem' },
    '@/components/icons/LineIcon': { LineIcon: 'LineIcon' },
    '@/hooks': { confirmAction: async (options) => {
      confirmations.push(options)
      return typeof confirm === 'function' ? confirm() : confirm
    } },
    '@/stores/auth': { useAuthStore: store },
    '@/utils/router': {
      navigateTo: (url) => actions.push(`to:${url}`),
      redirectToLogin: (relaunch) => {
        assert.equal(relaunch, false)
        actions.push('login')
      },
    },
    './index.module.scss': {},
  }).default
  const elements = []
  const render = () => {
    stateIndex = 0
    refIndex = 0
    elements.length = 0
    ;(function collect(node) {
      if (!node || typeof node !== 'object') return
      elements.push(node)
      for (const child of [node.props?.children].flat(Infinity)) collect(child)
    })(component())
    return elements
  }
  render()
  return {
    actions,
    confirmations,
    render,
    tree: () => elements,
    row: (title) =>
      elements.find((node) => node.type === 'ListItem' && node.props.title === title),
    sheet: () => elements.find((node) => node.type === 'ActionSheet'),
  }
}

test('个人中心点击退出登录直接确认，确认后清理会话并回到登录页', async () => {
  const h = mineHarness(true)
  const row = h.row('退出登录')
  assert.ok(row, '退出登录是管理列表中的一行')
  assert.equal(row.props.showArrow, false, '确认操作不显示导航箭头')
  await row.props.onClick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.confirmations.length, 1, '点击行立即弹出确认')
  assert.deepEqual(h.confirmations[0], {
    title: '退出登录', content: '确定要退出当前账号吗？', confirmText: '退出',
  })
  assert.deepEqual(h.actions, ['logout', 'login'])
  assert.equal(h.sheet(), undefined)
})

test('个人中心取消退出登录时不动会话与路由', async () => {
  const h = mineHarness(false)
  await h.row('退出登录').props.onClick()
  await new Promise((resolve) => setImmediate(resolve))
  h.render()
  assert.deepEqual(h.actions, [])
  assert.equal(h.confirmations.length, 1)
})

test('退出确认与登出期间重复点击只执行一次，取消后可再次点击', async () => {
  const confirmation = deferred()
  const logout = deferred()
  const h = mineHarness(() => confirmation.promise, { logout: () => logout.promise })
  const click = h.row('退出登录').props.onClick
  const pending = click()
  await click()
  assert.equal(h.confirmations.length, 1)
  confirmation.resolve(true)
  await new Promise((resolve) => setImmediate(resolve))
  await click()
  assert.deepEqual(h.actions, ['logout'])
  logout.resolve()
  await pending
  assert.deepEqual(h.actions, ['logout', 'login'])

  const cancelled = mineHarness(false)
  await cancelled.row('退出登录').props.onClick()
  await cancelled.row('退出登录').props.onClick()
  assert.equal(cancelled.confirmations.length, 2)
  assert.deepEqual(cancelled.actions, [])
})

test('退出失败不跳转且释放重复点击锁', async () => {
  const h = mineHarness(true, { logout: async () => { throw new Error('退出失败') } })
  await assert.rejects(h.row('退出登录').props.onClick(), /退出失败/)
  await assert.rejects(h.row('退出登录').props.onClick(), /退出失败/)
  assert.equal(h.confirmations.length, 2)
  assert.deepEqual(h.actions, ['logout', 'logout'])
})

test('个人中心保留四个现有入口的跳转目标', () => {
  const page = pageSource('src/pages/mine/index.tsx')
  for (const target of ['profileEdit', 'security', 'messages', 'about']) {
    assert.match(page, new RegExp(`SECONDARY_PAGES\\.${target}`), `${target} 入口不变`)
  }
  assert.match(page, /\{`关于\$\{APP_NAME\}`\}/, '关于入口标题仍带应用名')
})
