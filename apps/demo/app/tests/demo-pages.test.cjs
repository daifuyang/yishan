const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { loadTs } = require('./helpers/load-ts.cjs')

const srcRoot = path.resolve(__dirname, '../src')
const read = (file) => fs.readFileSync(path.join(srcRoot, file), 'utf8')
const pages = {
  health: read('pages/demo/health/index.tsx'),
  quickstart: read('pages/demo/quickstart/index.tsx'),
  region: read('pages/demo/region/index.tsx'),
  todos: read('pages/demo/todos/index.tsx'),
  todoDetail: read('pages/demo/todos/detail/index.tsx'),
  todoForm: read('pages/demo/todos/form/index.tsx'),
}
// 「组件演示，非页面样板」只挂在三个真正的展示页上：health / quickstart / region。
// todos 系列是普通业务页，写文件头注释会误导读者把它当成示例去照搬。
const SHOWCASE_HEADER = '组件演示，非页面样板'
const showcasePages = ['health', 'quickstart', 'region']
const featurePages = ['todos', 'todoDetail', 'todoForm']

// ---------- 健康检查纯函数 ----------

const health = loadTs('src/pages/demo/health/model.ts')

test('formatUptime 与 PC 输出一致：一分钟内显示秒，其余跳过为零的天/时/分', () => {
  assert.equal(health.formatUptime(0), '0 s')
  assert.equal(health.formatUptime(45), '45 s')
  assert.equal(health.formatUptime(60), '1m')
  assert.equal(health.formatUptime(3600), '1h')
  assert.equal(health.formatUptime(86400 * 2 + 3600 * 3 + 60 * 5 + 7), '2d 3h 5m')
  assert.equal(health.formatUptime(86400 + 60), '1d 1m')
})

test('formatBytes 逐级换算并保留两位小数', () => {
  assert.equal(health.formatBytes(0), '0.00 B')
  assert.equal(health.formatBytes(1023), '1023.00 B')
  assert.equal(health.formatBytes(1536), '1.50 KB')
  assert.equal(health.formatBytes(8589934592), '8.00 GB')
  assert.equal(health.formatBytes(1024 ** 5 * 3), '3072.00 TB')
})

test('memoryUsage 返回 0–100 的已用百分比，异常输入被钳住', () => {
  assert.equal(health.memoryUsage({ total: 8, free: 4 }), 50)
  assert.equal(health.memoryUsage({ total: 0, free: 0 }), 0)
  assert.equal(health.memoryUsage({ total: 100, free: 200 }), 0)
  assert.equal(health.memoryUsage({ total: 100, free: -50 }), 100)
  assert.equal(health.memoryUsed({ total: 100, free: 30 }), 70)
  assert.equal(health.memoryUsed({ total: 100, free: 300 }), 0)
})

test('envLabel 映射运行环境文案与已有的 Tag 变体', () => {
  assert.deepEqual(health.envLabel('production'), { label: '生产', variant: 'success' })
  assert.deepEqual(health.envLabel('pre'), { label: '预发', variant: 'warning' })
  assert.deepEqual(health.envLabel('test'), { label: '测试', variant: 'primary' })
  assert.deepEqual(health.envLabel('development'), { label: '开发', variant: 'default' })
  assert.deepEqual(health.envLabel(''), { label: '开发', variant: 'default' })
})

// ---------- 页面结构 ----------

for (const [name, source] of Object.entries(pages)) {
  test(`${name} 页不再使用旧 AdminPage / AdminSelect / AdminNotice 与白卡`, () => {
    assert.doesNotMatch(source, /\bAdmin(Page|Select|Notice)\b/)
    assert.doesNotMatch(source, /admin-card|admin-row|admin-notice/)
    assert.doesNotMatch(source, /` · |' · '/, '不应用 · 拼接属性')
  })
  test(`${name} 页用 withAccountScope 隔离账号，而不是手写 key={identity}`, () => {
    assert.match(source, /export default withAccountScope\(/)
    assert.doesNotMatch(source, /key=\{identity/)
  })
  test(`${name} 页通过 @/components/management 入口消费共享原子，而不是深路径`, () => {
    assert.match(source, /from '@\/components\/management'/)
    assert.doesNotMatch(source, /from '@\/components\/management\/[A-Za-z]+'/, '深路径会绕开 barrel')
  })
}

for (const name of showcasePages) {
  test(`${name} 是组件展示页：文件头声明「${SHOWCASE_HEADER}」`, () => {
    // 文件头注释用 // 写在 import 之前；允许中间夹其他单行注释，但首条必须提到这一行
    const header = pages[name].slice(0, pages[name].indexOf('import'))
    assert.match(header, new RegExp(SHOWCASE_HEADER))
  })
}

for (const name of featurePages) {
  test(`${name} 是普通业务页：不要挂「${SHOWCASE_HEADER}」文件头注释`, () => {
    const header = pages[name].slice(0, pages[name].indexOf('import'))
    assert.doesNotMatch(header, new RegExp(SHOWCASE_HEADER))
  })
}

test('健康检查是只读详情页：Hero + 分组 + 折叠的记录分组，时间走 formatDateTime', () => {
  const source = pages.health
  assert.match(source, /useRequireAuth\(\{ moduleId: 'demo-health' \}\)/)
  assert.match(source, /<DetailHero/)
  for (const title of ['运行状态', '运行时信息'])
    assert.match(source, new RegExp(`<DetailSection title="${title}">`))
  assert.match(source, /<DetailSection title="记录" collapsible defaultCollapsed>/)
  assert.match(source, /formatDateTime\(info\.timestamp\)/)
  assert.match(source, /usePullDownRefresh/)
  assert.match(source, /current === generation\.current/, '保留代次守卫，丢弃过期响应')
  // Hero 已经承担「运行环境」与「运行时长」的首屏位置，分组里再列就重了
  assert.doesNotMatch(source, /<DetailRow label="运行环境"/)
  assert.doesNotMatch(source, /<DetailRow label="运行时长"/)
})

test('快速入门：示例入口是带箭头的 LinkRow，接入步骤是只读多行行', () => {
  const source = pages.quickstart
  assert.match(source, /useRequireAuth\(\{ moduleId: 'demo-quickstart' \}\)/)
  assert.match(source, /<LinkRow/)
  assert.match(source, /backendModuleId === 'demo' && module\.id !== 'demo-quickstart'/)
  assert.match(source, /<DetailRow key=\{title\} label=\{title\} value=\{content\} multiline \/>/)
  for (const step of ['定义模块', '实现业务接口', '安装到产品', '配置页面与入口', '执行迁移与验证'])
    assert.match(source, new RegExp(`'${step}'`))
})

test('省市级联：两种加载模式各一个分组，按权限整组隐藏，选区走 PickerRow', () => {
  const source = pages.region
  assert.match(source, /useRequireAuth\(\{ moduleId: 'demo-region' \}\)/)
  assert.match(source, /canList \? <RegionExample title="按需加载" mode="lazy" \/> : null/)
  assert.match(source, /canTree \? <RegionExample title="整树加载" mode="tree" \/> : null/)
  // 选区改用 PickerRow，表单分组只放可点击入口；读出去走 DetailSection + DetailRow
  assert.match(source, /<PickerRow/)
  assert.match(source, /label="所在地区"/)
  assert.match(source, /<FormSection title=\{title\}>/)
  assert.match(source, /<DetailSection title="已选地区"/)
  assert.match(source, /<RegionPicker/)
  assert.match(source, /useCanWrite\('region:path'\)/)
  assert.match(source, /current === generation\.current/, '回填路径保留过期响应守卫')
  assert.doesNotMatch(source, /需要地区树查看权限/)
})

test('Todo 表单：日期行走 DateField，标题 / 状态 / 描述 / 截止时间分组保持原结构', () => {
  const source = pages.todoForm
  // 日期行从裸 Picker 升级到共享原子 DateField，避免再写一份 picker/pickerValue/pickerPlaceholder
  assert.match(source, /<DateField\b/)
  assert.match(source, /<FormField label="日期" arrow[^>]*>\s*<DateField/)
  assert.doesNotMatch(source, /styles\.pickerPlaceholder/)
  // 业务结构保持：基础信息 / 截止时间 / 提交栏 + FormError
  assert.match(source, /<FormSection title="基础信息">/)
  assert.match(source, /<FormSection title="截止时间">/)
  assert.match(source, /<FormSubmitBar/)
  assert.match(source, /<FormError>\{submitError\}<\/FormError>/)
  // CRUD 行为不变：关闭开关清空 dueAt、打开且没选日期要报错，model.ts 已有断言守在这里
  assert.match(source, /hasDue \? \{ hasDue, date: values\.date \|\| todayDate\(\) \}/)
})

// ---------- RegionPicker 纯逻辑 ----------

const logic = loadTs('src/components/management/regionPickerLogic.ts')
const tree = [
  {
    code: 44,
    name: '广东省',
    children: [
      { code: 4403, name: '深圳市', children: [{ code: 440305, name: '南山区' }] },
      { code: 4420, name: '中山市', children: [] },
    ],
  },
  { code: 71, name: '台湾省' },
]

test('regionTabs：已选名称 + 未完成时末尾的「请选择」', () => {
  const plain = (tabs) => tabs.map((tab) => `${tab.depth}:${tab.label}${tab.pending ? '?' : ''}`)
  assert.deepEqual(plain(logic.regionTabs([], false)), ['0:请选择?'])
  assert.deepEqual(plain(logic.regionTabs([tree[0]], false)), ['0:广东省', '1:请选择?'])
  assert.deepEqual(plain(logic.regionTabs([tree[0], tree[0].children[1]], true)), ['0:广东省', '1:中山市'])
  const full = [tree[0], tree[0].children[0], tree[0].children[0].children[0]]
  assert.deepEqual(plain(logic.regionTabs(full, false)), ['0:广东省', '1:深圳市', '2:南山区'])
})

test('isRegionLeaf：到达区县必为末级；整树看 children，按需模式 children 缺省表示未知', () => {
  assert.equal(logic.isRegionLeaf({ code: 1, name: 'x' }, 2, 'lazy'), true)
  assert.equal(logic.isRegionLeaf(tree[0], 0, 'tree'), false)
  assert.equal(logic.isRegionLeaf(tree[1], 0, 'tree'), true)
  assert.equal(logic.isRegionLeaf(tree[1], 0, 'lazy'), false)
  assert.equal(logic.isRegionLeaf(tree[0].children[1], 1, 'lazy'), true)
})

test('selectRegion 截断旧的下级选择；regionOptionsInTree 沿路径下钻', () => {
  const full = [tree[0], tree[0].children[0], tree[0].children[0].children[0]]
  assert.deepEqual(
    logic.selectRegion(full, 1, tree[0].children[1]).map((n) => n.name),
    ['广东省', '中山市'],
  )
  assert.deepEqual(logic.regionOptionsInTree(tree, [], 0).map((n) => n.name), ['广东省', '台湾省'])
  assert.deepEqual(
    logic.regionOptionsInTree(tree, [{ code: '44', name: '广东省' }], 1).map((n) => n.code),
    [4403, 4420],
  )
  assert.deepEqual(logic.regionOptionsInTree(tree, full, 2).map((n) => n.name), ['南山区'])
  assert.deepEqual(logic.regionOptionsInTree(tree, [{ code: 99, name: '?' }], 1), [])
  assert.equal(logic.regionParentKey(full, 0), '')
  assert.equal(logic.regionParentKey(full, 2), '4403')
  assert.equal(logic.formatRegionPath(full), '广东省 / 深圳市 / 南山区')
})

// ---------- RegionPicker 交互（最小 hooks 运行时驱动真实组件） ----------

function harness(props) {
  const slots = []
  let cursor = 0
  let effects = []
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots))
        slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [
        slots[index].value,
        (next) => {
          slots[index].value = typeof next === 'function' ? next(slots[index].value) : next
        },
      ]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect, deps) {
      const index = cursor++
      if (deps && slots[index]?.deps?.every((v, i) => Object.is(v, deps[i]))) return
      const cleanup = slots[index]?.cleanup
      slots[index] = { deps }
      effects.push(() => {
        cleanup?.()
        slots[index].cleanup = effect()
      })
    },
  }
  const { RegionPicker } = loadTs('src/components/management/RegionPicker.tsx', {
    react,
    '@tarojs/components': { View: 'View', Text: 'Text', ScrollView: 'ScrollView' },
    '@/components/feedback': { StateView: 'StateView' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './RegionPicker.module.scss': new Proxy({}, { get: (_, key) => (key === '__esModule' ? undefined : String(key)) }),
  })
  const nodes = (value) =>
    !value || typeof value !== 'object'
      ? []
      : Array.isArray(value)
        ? value.flatMap(nodes)
        : [value, ...nodes(value.props?.children)]
  let rendered
  const render = () => {
    for (let round = 0; round < 10; round++) {
      cursor = 0
      const outer = RegionPicker(props)
      rendered = outer?.type(outer.props)
      const pending = effects
      effects = []
      if (!pending.length) break
      for (const run of pending) run()
    }
    return nodes(rendered)
  }
  return {
    render,
    async settle() {
      for (let i = 0; i < 4; i++) {
        render()
        await new Promise(setImmediate)
      }
      return render()
    },
    option: (name) =>
      render().find(
        (n) => n.props?.['aria-label'] === name && n.props?.className?.startsWith('option'),
      ),
    tabs: () =>
      render()
        .filter((n) => typeof n.props?.className === 'string' && n.props.className.split(' ').includes('tab'))
        .map((n) => n.props['aria-label']),
    stateView: () => render().find((n) => n.type === 'StateView'),
  }
}

test('RegionPicker 按需模式：逐级查询下级，查回空列表的节点直接确认', async () => {
  const calls = []
  const confirmed = []
  const children = {
    root: [{ code: 44, name: '广东省' }],
    44: [
      { code: 4403, name: '深圳市' },
      { code: 4420, name: '中山市' },
    ],
    4420: [],
  }
  const h = harness({
    open: true,
    mode: 'lazy',
    value: [],
    loadChildren: async (parent) => {
      const key = parent ? parent.code : 'root'
      calls.push(key)
      return children[key]
    },
    onConfirm: (picked) => confirmed.push(picked.map((n) => n.name)),
    onClose: () => {},
  })
  assert.equal(h.stateView().props.kind, 'loading')
  await h.settle()
  assert.deepEqual(h.tabs(), ['请选择'])
  h.option('广东省').props.onClick()
  await h.settle()
  assert.deepEqual(h.tabs(), ['广东省', '请选择'])
  h.option('中山市').props.onClick()
  await h.settle()
  assert.deepEqual(calls, ['root', 44, 4420])
  assert.deepEqual(confirmed, [['广东省', '中山市']])
})

test('RegionPicker 整树模式：加载失败可重试，成功后只加载一次，选到区县即确认', async () => {
  let loads = 0
  let fail = true
  const confirmed = []
  const h = harness({
    open: true,
    mode: 'tree',
    value: [],
    loadTree: async () => {
      loads++
      if (fail) throw new Error('网络错误')
      return tree
    },
    onConfirm: (picked) => confirmed.push(picked.map((n) => n.name)),
    onClose: () => {},
  })
  await h.settle()
  assert.equal(h.stateView().props.kind, 'error')
  assert.equal(h.stateView().props.text, '网络错误')
  fail = false
  h.stateView().props.onRetry()
  await h.settle()
  assert.equal(h.stateView().props.kind, 'ready')
  h.option('广东省').props.onClick()
  await h.settle()
  h.option('深圳市').props.onClick()
  await h.settle()
  assert.deepEqual(h.tabs(), ['广东省', '深圳市', '请选择'])
  h.option('南山区').props.onClick()
  assert.deepEqual(confirmed, [['广东省', '深圳市', '南山区']])
  assert.equal(loads, 2)
})

test('RegionPicker 关闭时不渲染；打开时回显已选值并标记当前项', async () => {
  const value = [tree[0], tree[0].children[0], tree[0].children[0].children[0]]
  const base = { mode: 'tree', value, loadTree: async () => tree, onConfirm() {}, onClose() {} }
  assert.deepEqual(harness({ ...base, open: false }).render(), [])
  const h = harness({ ...base, open: true })
  await h.settle()
  assert.deepEqual(h.tabs(), ['广东省', '深圳市', '南山区'])
  assert.equal(h.option('南山区').props['aria-selected'], true)
})

test('RegionPicker 不依赖产品 API，并从 management 入口导出', () => {
  const source = read('components/management/RegionPicker.tsx')
  assert.doesNotMatch(source, /@\/api\//)
  assert.doesNotMatch(source, /\bdocument\.|\bwindow\./)
  const index = read('components/management/index.ts')
  assert.match(index, /RegionPicker, type RegionPickerProps/)
})
