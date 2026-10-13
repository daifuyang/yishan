const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const src = (file) => fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8')
const PAGES = {
  attachmentDetail: ['detail', null],
  attachmentForm: ['form', "['system:attachment:update']"],
  attachmentImport: ['import', "['system:attachment:create']"],
  attachmentFolders: ['folders', null],
  attachmentFolderForm: ['folder-form', null],
}

test('媒体库新页面已注册路由、页面配置与模块访问', () => {
  for (const [key, [dir, permissions]] of Object.entries(PAGES)) {
    const page = `pages/system/attachments/${dir}/index`
    assert.match(src('constants/routes.ts'), new RegExp(`${key}: '${page}'`))
    assert.match(src('constants/page-config.ts'), new RegExp(`'${page}'`))
    const entry = new RegExp(`'${page}': \\{\\s*moduleId: 'system-attachments'${permissions ? `,\\s*permissions: ${permissions.replace(/[[\]]/g, '\\$&')}` : ''}`)
    assert.match(src('modules/registry.ts'), entry, page)
    assert.ok(fs.existsSync(path.resolve(__dirname, '../src', `${page}.tsx`)))
    // folders/folder-form 全平台渲染 ManagementPageHeader → 'custom'；
    // 其余页只在 H5 渲染 ManagementPageHeader → weapp 必须保留原生导航栏
    assert.match(
      src(`pages/system/attachments/${dir}/index.config.ts`),
      /navigationStyle: (?:'custom'|process\.env\.TARO_ENV === 'h5' \? 'custom' : 'default'),/,
    )
  }
})

test('只在 H5 渲染 ManagementPageHeader 的媒体库页在 weapp 保留原生导航栏', () => {
  for (const dir of ['detail', 'form', 'import']) {
    assert.match(
      src(`pages/system/attachments/${dir}/index.config.ts`),
      /navigationStyle: process\.env\.TARO_ENV === 'h5' \? 'custom' : 'default',/,
      dir,
    )
  }
})
