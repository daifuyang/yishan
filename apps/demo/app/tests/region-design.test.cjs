const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const srcRoot = path.resolve(__dirname, '../src')
const regionPage = fs.readFileSync(
  path.join(srcRoot, 'pages/system/region/index.tsx'),
  'utf8',
)

// 规范：列表单元格只放一行描述，且「不要用 · 拼接属性」——
// 层级、下级数量是结构性事实，应该进详情页或右列标签，不是塞进副标题串起来。
test('地区列表不再用 · 拼接层级、代码与下级数量', () => {
  assert.doesNotMatch(regionPage, /` · /, '描述里不应出现 · 拼接的结构化属性')
})

test('地区列表把行政层级放进右列标签，描述只留一条信息', () => {
  assert.match(regionPage, /tag=\{/, '单元格右列应放层级标签')
  assert.match(regionPage, /description=\{[^}]*node\.code/s, '描述应只承载代码')
})

// 叶子（区县）没有下级可进，箭头是假的导航承诺。
test('没有下级的地区不显示箭头', () => {
  assert.match(regionPage, /showArrow=\{hasChildren\}/, '箭头应取决于是否有下级')
})

test('区县级使用定位图标，不再用方块占位', () => {
  assert.match(regionPage, /node\.level === 3 \? 'mapPin'/, '第三级区县应使用定位针')
})

// useReachBottom 已经在自动加载，再摆一个「加载更多」按钮等于两套机制抢同一件事，
// 而且它绕开了 ManagementListFooter 的统一提示。
test('地区页不再自建「加载更多」按钮，统一交给 ManagementListFooter', () => {
  assert.doesNotMatch(regionPage, /加载更多/, '不应有手写的加载更多入口')
  assert.doesNotMatch(regionPage, /styles\.more/, '不应有页面私有的加载更多样式')
})

// 面包屑是层级导航，属于可复用的交互，不该每个页面用裸 Text 手搓一份。
test('地区页的面包屑改用共享 Breadcrumbs 组件', () => {
  assert.match(regionPage, /<Breadcrumbs/, '应使用共享面包屑组件')
  assert.doesNotMatch(regionPage, /styles\.path/, '不应再有页面私有面包屑样式')
})

test('页面私有样式收敛：面包屑与加载更多都不再本地定义', () => {
  // 两处样式都搬进了共享组件或直接删除，页面不再需要自己的 scss
  assert.equal(
    fs.existsSync(path.join(srcRoot, 'pages/system/region/index.module.scss')),
    false,
    '地区页不应再有私有样式文件',
  )
  assert.doesNotMatch(regionPage, /from '\.\/index\.module\.scss'/, '不应再引入私有样式')
})
