const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTs, appRoot } = require('./helpers/load-ts.cjs')

const metrics = loadTs('src/pages/index/home-metrics.ts')
const todos = loadTs('src/pages/index/home-todos.ts')
const icons = loadTs('src/pages/index/home-icons.ts')

test('home metrics are hidden without the dashboard permission and capped at four', () => {
  assert.deepEqual(metrics.getVisibleMetrics(undefined), [])
  assert.deepEqual(metrics.getVisibleMetrics(['system:user:list']), [])
  const visible = metrics.getVisibleMetrics(['system:dashboard:read'])
  assert.deepEqual(
    visible.map((def) => def.key),
    ['userTotal', 'deptTotal', 'todayLogin', 'online'],
  )
  assert.ok(visible.length <= metrics.MAX_HOME_METRICS)
})

test('metric values keep a real zero and never disguise missing data as zero', () => {
  assert.equal(metrics.formatMetricValue(0), '0')
  assert.equal(metrics.formatMetricValue(1234), '1,234')
  assert.equal(metrics.formatMetricValue(12000), '1.2万')
  assert.equal(metrics.formatMetricValue(50000), '5万')
  assert.equal(metrics.formatMetricValue(320000000), '3.2亿')
  assert.equal(metrics.formatMetricValue(undefined), null)
  assert.equal(metrics.formatMetricValue(Number.NaN), null)
})

test('home todos stay hidden until a real source is registered', () => {
  assert.equal(todos.HOME_TODO_SOURCES.length, 0)
  const source = { id: 's', permission: 'p', load: async () => [] }
  assert.deepEqual(todos.getVisibleTodoSources(['p'], [source]), [source])
  assert.deepEqual(todos.getVisibleTodoSources(['x'], [source]), [])
})

test('home todos prefer urgent, then overdue, then earliest due', () => {
  const item = (id, priority, dueAt) => ({ id, title: id, priority, dueAt, entry: 'pages/x' })
  const top = todos.pickTopTodos([
    item('normal-early', 'normal', '2026-01-01'),
    item('overdue', 'overdue', '2026-03-01'),
    item('urgent-late', 'urgent', '2026-05-01'),
    item('urgent-early', 'urgent', '2026-02-01'),
  ])
  assert.deepEqual(
    top.map((entry) => entry.id),
    ['urgent-early', 'urgent-late', 'overdue'],
  )
})

test('home app icons resolve antd/menu names and fall back to a grid glyph', () => {
  assert.equal(icons.resolveHomeIcon(undefined, 'ContactsOutlined'), 'users')
  assert.equal(icons.resolveHomeIcon('user', 'UserOutlined'), 'user')
  assert.equal(icons.resolveHomeIcon('unknown-icon', null), 'layoutGrid')
  assert.match(icons.homeIconBackground('bell', '#1D2129'), /^url\("data:image\/svg\+xml,/)
})

test('首页常用应用来自后端排序并统一走工作台打开', () => {
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/index/index.tsx'), 'utf8')
  assert.match(page, /getHomeApps\(/)
  assert.match(page, /openWorkbenchApp\(/)
  assert.match(page, /SECONDARY_PAGES\.homeApps/)
  assert.match(page, /<SectionLink text="编辑"/)
  assert.doesNotMatch(page, /commonModuleIds|commonConfigured/)
})

// 首页源码目录（含本地组件）的一次性读取，供下面几条页面线契约断言共用
function homeSources() {
  const dir = path.join(appRoot, 'src/pages/index')
  const walk = (current, out) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full, out)
      else if (entry.name.endsWith('.tsx')) out.push(full)
    }
    return out
  }
  return { dir, files: walk(dir, []) }
}

test('首页跳转箭头统一走 LineIcon，不再渲染裸 ›', () => {
  const { dir, files } = homeSources()
  assert.ok(files.length > 0, '首页源码目录不应为空')
  const arrows = files.filter((file) => fs.readFileSync(file, 'utf8').includes('›'))
  assert.deepEqual(
    arrows.map((file) => path.relative(dir, file)),
    [],
    '裸 › 必须替换为共享 LineIcon',
  )
  assert.ok(
    files.some((file) => /<LineIcon\b/.test(fs.readFileSync(file, 'utf8'))),
    '跳转箭头改用共享 LineIcon',
  )
})

test('首页卡片复用共享 SurfaceCard / MetricCard，不再自绘白色卡片', () => {
  const read = (file) =>
    fs.readFileSync(path.join(appRoot, 'src/pages/index/components', file), 'utf8')
  const metrics = read('DashboardMetrics.tsx')
  assert.match(
    metrics,
    /import \{[^}]*\bMetricCard\b[^}]*\} from '@\/components\/management'/,
    '指标卡复用共享 MetricCard',
  )
  assert.doesNotMatch(metrics, /export function MetricCard/, '不再本地自绘指标卡')
  assert.match(read('FavoriteApps.tsx'), /<SurfaceCard\b/, '常用应用白块复用共享 SurfaceCard')
})

test('首页自绘导航栏用全局安全区变量避让 H5 刘海', () => {
  const scss = fs.readFileSync(path.join(appRoot, 'src/pages/index/index.module.scss'), 'utf8')
  assert.match(scss, /\.home__topBar \{[\s\S]*?--safe-area-top/, 'H5 自绘导航栏需避让安全区')
})
