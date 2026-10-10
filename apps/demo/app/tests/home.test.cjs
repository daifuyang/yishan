const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

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
