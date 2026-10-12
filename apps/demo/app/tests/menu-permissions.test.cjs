const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const srcRoot = path.resolve(__dirname, '../src')
const formSource = fs.readFileSync(
  path.join(srcRoot, 'pages/system/menu/form/index.tsx'),
  'utf8',
)
const pageSource = fs.readFileSync(
  path.join(srcRoot, 'pages/system/menu/permissions/index.tsx'),
  'utf8',
)
const modelSource = fs.readFileSync(
  path.join(srcRoot, 'pages/system/menu/model.ts'),
  'utf8',
)

// 编辑菜单只留一个入口：一份几十项的功能目录铺在编辑页里，会把「改菜单属性」
// 撑成长表单，而且改完名字顺手点保存，很容易把没细看的权限关联一起提交掉。
test('编辑菜单页只保留关联功能入口，不再内嵌功能目录', () => {
  assert.doesNotMatch(formSource, /getAdminPermissionCatalog/, '编辑页不再拉取功能目录')
  assert.doesNotMatch(formSource, /<Checkbox/, '编辑页不再内嵌勾选列表')
  assert.match(formSource, /label="关联功能"/, '应保留关联功能入口行')
  assert.match(formSource, /SYSTEM_PAGES\.menuPermissions/, '入口应跳转到关联功能页')
})

test('入口展示已选数量，未选时给出明确文案', () => {
  assert.match(
    formSource,
    /value=\{values\.permissionCodes\.length \? `已选择 \$\{values\.permissionCodes\.length\} 个` : "未选择"\}/,
  )
})

// 后端 updateMenu 只在 req.permissionCodes !== undefined 时才替换关联，
// 所以编辑菜单的载荷里绝不能带 permissionCodes —— 否则会覆盖用户在
// 关联功能页刚保存的结果。
test('编辑菜单的载荷不带 permissionCodes，避免覆盖关联功能页的结果', () => {
  const start = modelSource.indexOf('export function menuPayload')
  const payload = modelSource.slice(start, modelSource.indexOf('\n}', start))
  const directoryBranch = payload.match(/isDirectory \? \[\] : values\.permissionCodes/)
  assert.ok(
    !directoryBranch,
    'menuPayload 不应再提交 permissionCodes，关联功能由独立页负责',
  )
})

test('关联功能页已注册路由与模块权限', () => {
  const routes = fs.readFileSync(path.join(srcRoot, 'constants/routes.ts'), 'utf8')
  const pages = fs.readFileSync(path.join(srcRoot, 'constants/page-config.ts'), 'utf8')
  const registry = fs.readFileSync(path.join(srcRoot, 'modules/registry.ts'), 'utf8')
  assert.match(routes, /menuPermissions: 'pages\/system\/menu\/permissions\/index'/)
  assert.match(pages, /'pages\/system\/menu\/permissions\/index'/)
  assert.match(registry, /'pages\/system\/menu\/permissions\/index': \{ moduleId: 'system-menu' \}/)
})

test('关联功能页只提交 permissionCodes，不动菜单其它属性', () => {
  assert.match(
    pageSource,
    /updateAdminMenu\(id, \{ permissionCodes: \[\.\.\.selected\] \}\)/,
    '应只提交 permissionCodes',
  )
  assert.doesNotMatch(pageSource, /updateAdminMenu\(id, \{[^}]*name:/, '不应顺带提交菜单名')
})

test('关联功能页具备搜索、多选与底部保存', () => {
  assert.match(pageSource, /ManagementSearchBar/, '应有搜索框')
  assert.match(pageSource, /搜索功能名称或编码/, 'placeholder 应说明搜什么')
  assert.match(pageSource, /<Checkbox checked=\{selected\.has\(item\.code\)\}/, '列表项应为可勾选')
  assert.match(pageSource, /FormSubmitBar text="保存"/, '底部应有固定保存按钮')
  assert.match(pageSource, /已选 \{selected\.size\} 项/, '应展示已选数量')
})

test('关联功能页需要菜单更新与功能目录查看两项权限', () => {
  assert.match(
    pageSource,
    /const REQUIRED = \['system:menu:update', 'system:permission:catalog'\]/,
  )
})
