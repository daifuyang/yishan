const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const srcRoot = path.resolve(__dirname, '../src')

const DETAIL_PAGES = [
  'pages/system/user/detail/index.tsx',
  'pages/system/role/detail/index.tsx',
  'pages/system/position/detail/index.tsx',
  'pages/system/dept/detail/index.tsx',
  'pages/system/menu/detail/index.tsx',
  'pages/system/app-menu/detail/index.tsx',
  'pages/system/dict/DictionaryDetail.tsx',
  'pages/system/module-management/detail/index.tsx',
]

function read(file) {
  return fs.readFileSync(path.join(srcRoot, file), 'utf8')
}

/**
 * 取出 `const actions: BottomAction[] = [...]` 的数组体。
 * 各页面的缩进和嵌套深度不一样（三元表达式里还有一层），所以按括号配对来找结尾，
 * 不靠缩进猜。
 */
function actionsBlock(file) {
  const source = read(file)
  const start = source.indexOf('const actions: BottomAction[]')
  assert.notEqual(start, -1, `${file} 应声明 BottomAction 数组`)
  // 注意：`BottomAction[]` 的类型标注里也有一个 `[`，要从赋值号之后开始找
  const assign = source.indexOf('=', start)
  const open = source.indexOf('[', assign)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth++
    else if (source[i] === ']') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  assert.fail(`${file} 的 actions 数组应闭合`)
}

function actionKeys(file) {
  return [...actionsBlock(file).matchAll(/key: '([^']+)'/g)].map((m) => m[1])
}

// 底部固定操作栏高度固定、可点区域有限。超过三个之后每个按钮被压到不足
// 44px 的触摸目标，而且「禁用」这类低频动作长期占着一个黄金位置。
test('详情页底部最多只展示 3 个操作', () => {
  for (const file of DETAIL_PAGES) {
    const keys = actionKeys(file)
    // 菜单类页面静态上有 4 个分支，但「新建下级」和「启用/禁用」互斥，
    // 运行时最多同时出现一个 —— 真正渲染的是 3 个。
    const exclusive =
      keys.includes('child') && keys.includes('toggle') && isMutuallyExclusive(file)
    assert.ok(
      keys.length <= 3 || exclusive,
      `${file} 底部有 ${keys.length} 个操作（${keys.join(', ')}），应不超过 3 个`,
    )
  }
})

/**
 * 「新建下级」和「启用/禁用」是否由同一个开关互斥：
 * 前者由 canCreateChild 正向控制，后者由 !canCreateChild 反向控制。
 */
function isMutuallyExclusive(file) {
  const block = actionsBlock(file)
  return (
    /\.\.\.\(canCreateChild[\s\S]*?key: 'child'/.test(block) &&
    /\.\.\.\(canUpdate && !canCreateChild[\s\S]*?key: 'toggle'/.test(block)
  )
}

const CONDITIONAL_PAGES = [
  'pages/system/menu/detail/index.tsx',
  'pages/system/app-menu/detail/index.tsx',
]

// 启用/禁用低频但可逆，不是该藏的东西：底部分得开（没有新建操作）就放出来，
// 挤到三个时才收进「更多」。两个位置必须由同一个条件互补决定，否则会同时出现。
test('启用/禁用与新建下级由同一开关互补控制', () => {
  for (const file of CONDITIONAL_PAGES) {
    assert.ok(isMutuallyExclusive(file), `${file} 的新建与启停用应互斥`)
  }
})

test('启用/禁用只在底部放不下时才出现在更多菜单里', () => {
  for (const file of CONDITIONAL_PAGES) {
    const sheet = actionSheetOf(read(file), file)
    assert.match(
      sheet,
      /canUpdate && canCreateChild[\s\S]*?key: 'toggle'/,
      `${file} 的更多菜单应只在 canCreateChild 为真时提供启用/禁用`,
    )
  }
})

test('部门详情始终是三个操作，启用/禁用常驻更多菜单', () => {
  const file = 'pages/system/dept/detail/index.tsx'
  assert.deepEqual(actionKeys(file), ['edit', 'child', 'more'])
  assert.match(actionSheetOf(read(file), file), /key: 'toggle'/)
})

test('更多按钮用「更多」而不是「更多操作」，且图标是竖排三点', () => {
  for (const file of DETAIL_PAGES) {
    const source = read(file)
    if (!actionKeys(file).includes('more')) continue
    assert.match(source, /label: '更多'/, `${file} 的更多按钮应叫「更多」`)
    assert.doesNotMatch(source, /label: '更多操作'/, `${file} 不应再用「更多操作」`)
  }
})

test('更多按钮使用竖排三点图标', () => {
  for (const file of DETAIL_PAGES) {
    const source = read(file)
    if (!actionKeys(file).includes('more')) continue
    const block = source.slice(source.indexOf("key: 'more'"))
    assert.match(
      block.slice(0, 200),
      /icon: 'moreVertical'/,
      `${file} 的更多按钮应使用竖排三点图标`,
    )
  }
})

function actionSheetOf(source, file) {
  const start = source.indexOf('<ActionSheet')
  assert.notEqual(start, -1, `${file} 应有 ActionSheet`)
  const end = source.indexOf('/>', start)
  return source.slice(start, end + 2)
}

test('ActionSheet 里的删除仍是危险操作，排在最后', () => {
  for (const file of [
    'pages/system/menu/detail/index.tsx',
    'pages/system/app-menu/detail/index.tsx',
    'pages/system/dept/detail/index.tsx',
  ]) {
    const source = read(file)
    const sheetStart = source.indexOf('<ActionSheet')
    const sheet = source.slice(sheetStart, source.indexOf('/>', sheetStart) + 2)
    const toggleAt = sheet.indexOf("key: 'toggle'")
    const deleteAt = sheet.indexOf("key: 'delete'")
    assert.ok(toggleAt !== -1 && deleteAt !== -1)
    assert.ok(toggleAt < deleteAt, `${file} 的删除应排在启用/禁用之后，避免误触`)
  }
})
