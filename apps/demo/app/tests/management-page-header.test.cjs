const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const { loadTs } = require('./helpers/load-ts.cjs')

// SCSS 模块在平台边界上打桩成「返回 key 本身」的代理，
// 断言直接针对源码里写下的 class key，而不是构建后的哈希。
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

// 把返回的元素树摊平成节点数组，方便按 type / props 定位。
const flat = (v) =>
  !v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(flat) : [v, ...flat(v.props?.children)]

const classOf = (node) => String(node?.props?.className ?? '')

/** 每个用例单独加载，保证 navigateBack 桩只属于当前用例。 */
function loadHeader({ navigateBack = () => {} } = {}) {
  return loadTs('src/components/management/ManagementPage.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@/utils/router': { navigateBack },
    './ManagementPage.module.scss': scss,
  }).ManagementPageHeader
}

const findBack = (nodes) => nodes.find((n) => n.props?.['aria-label'] === '返回')

test('title / subtitle 支持 ReactNode', () => {
  const header = loadHeader()
  const titleNode = { type: 'TitleMark', props: {} }
  const subtitleNode = { type: 'SubtitleMark', props: {} }
  const nodes = flat(header({ title: titleNode, subtitle: subtitleNode }))

  assert.equal(nodes.find((n) => classOf(n) === 'header__title').props.children, titleNode)
  assert.equal(nodes.find((n) => classOf(n) === 'header__subtitle').props.children, subtitleNode)
})

test('subtitle 缺省时不渲染副标题节点', () => {
  const nodes = flat(loadHeader()({ title: '角色' }))
  assert.equal(nodes.find((n) => classOf(n) === 'header__subtitle'), undefined)
})

test('action 渲染在右侧槽位', () => {
  const actionNode = { type: 'ActionMark', props: {} }
  const nodes = flat(loadHeader()({ title: '用户', action: actionNode }))
  const right = nodes.find((n) => classOf(n).includes('header__sideRight'))
  assert.equal(right.props.children, actionNode)
})

test('bordered 默认有分隔线，bordered=false 时去掉', () => {
  const header = loadHeader()
  assert.match(classOf(header({ title: '角色' })), /headerBordered/)
  assert.doesNotMatch(classOf(header({ title: '角色', bordered: false })), /headerBordered/)
})

test('className 透传到根节点且不覆盖自带类名', () => {
  const nodes = flat(loadHeader()({ title: '角色', className: 'custom-header' }))
  assert.match(classOf(nodes[0]), /\bheader\b/)
  assert.match(classOf(nodes[0]), /custom-header/)
})

test('showBack=false 时不渲染返回控件（小程序由原生导航栏承载）', () => {
  const nodes = flat(loadHeader()({ title: '角色', showBack: false }))
  assert.equal(findBack(nodes), undefined)
})

test('showBack 默认渲染返回控件并优先走 onBack', () => {
  const header = loadHeader()
  let backs = 0
  const nodes = flat(header({ title: '角色', onBack: () => { backs += 1 } }))
  findBack(nodes).props.onClick()
  assert.equal(backs, 1)
})

test('未传 onBack 时回退到 navigateBack(1)', () => {
  const calls = []
  const header = loadHeader({ navigateBack: (delta) => calls.push(delta) })
  flat(header({ title: '角色' })).find((n) => n.props?.['aria-label'] === '返回').props.onClick()
  assert.deepEqual(calls, [1])
})

// 旧的 `right` 在迁移调用点映射到 `action`，公开接口不再保留第二个槽位名。
test('公开 prop 集合固定为 title/subtitle/action/bordered/className/onBack/showBack', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/components/management/ManagementPage.tsx'),
    'utf8',
  )
  const start = source.indexOf('export interface ManagementPageHeaderProps')
  assert.notEqual(start, -1, 'ManagementPageHeaderProps 必须是公开接口')
  const block = source.slice(start, source.indexOf('}', start))
  for (const prop of ['title', 'subtitle', 'action', 'bordered', 'className', 'onBack', 'showBack']) {
    assert.match(block, new RegExp(`${prop}\\??:`), `接口应保留 ${prop}`)
  }
  assert.doesNotMatch(block, /\bright\??:/, 'right 只在迁移调用点映射，不作为第二个公开 prop')
})
