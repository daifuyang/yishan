const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const srcRoot = path.resolve(__dirname, '../src')

// 列表页顶栏不再挂副标题：计数已经在列表底部的 ManagementListFooter 里，
// 顶栏再放一遍就是同一句话说两次，而且副标题把标题挤成两行。
const LIST_PAGES = [
  'pages/system/dept/index.tsx',
  'pages/system/dict/DictionaryList.tsx',
  'pages/system/login-log/index.tsx',
  'pages/system/module-management/index.tsx',
  'pages/system/position/index.tsx',
  'pages/system/region/index.tsx',
  'pages/system/role/index.tsx',
  'pages/system/user/index.tsx',
  'pages/profile/login-log/index.tsx',
]

function headerProps(file) {
  const source = fs.readFileSync(path.join(srcRoot, file), 'utf8')
  const start = source.indexOf('<ManagementPageHeader')
  assert.notEqual(start, -1, `${file} 应渲染 ManagementPageHeader`)
  // 标签可能是自闭合，也可能带子节点；截到对应的 '>' 为止即可覆盖两种写法。
  const end = source.indexOf('>', start)
  return source.slice(start, end)
}

test('管理列表页顶栏不带副标题', () => {
  for (const file of LIST_PAGES) {
    assert.doesNotMatch(
      headerProps(file),
      /subtitle=/,
      `${file} 的顶栏不应有 subtitle（计数由列表底部 summary 承担）`,
    )
  }
})

// 去掉副标题后，计数不能凭空消失：没有底部 summary 的页面必须补上。
test('去掉副标题的页面在列表底部保留计数', () => {
  for (const file of LIST_PAGES) {
    const source = fs.readFileSync(path.join(srcRoot, file), 'utf8')
    assert.match(
      source,
      /ManagementListFooter/,
      `${file} 应渲染 ManagementListFooter`,
    )
    assert.match(
      source,
      /summary=/,
      `${file} 的列表底部应保留 summary，否则计数无处显示`,
    )
  }
})
