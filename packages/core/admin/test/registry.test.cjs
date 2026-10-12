const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

test('registry uses the paired API installation, preserves keys and nested pages, excludes uninstalled modules', () => {
  const { generateModuleComponents } = require('../build/registry.cjs')
  const root = mkdtempSync(join(tmpdir(), 'admin-registry-'))
  const put = (name, content = 'export default () => null') => {
    const path = join(root, name)
    mkdirSync(require('node:path').dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  try {
    put('api/src/manifest.ts', "import { catalog } from './modules/catalog/module.js'; export const modules = [catalog] as const")
    put('api/src/modules/catalog/module.ts', "export const catalog = {id:'catalog'}")
    put('admin/src/pages/index.tsx')
    put('admin/src/modules/catalog/pages/reports/daily/index.tsx')
    put('admin/src/modules/absent/pages/secret/index.tsx')
    const source = generateModuleComponents({ adminRoot: join(root, 'admin'), apiRoot: join(root, 'api'), systemPages: { './system/user': '@example/system-admin/pages/user' } })
    assert.match(source, /"\.\/system\/user": \(\) => import\("@example\/system-admin\/pages\/user"\)/)
    assert.match(source, /"\.\/modules\/catalog\/reports\/daily"/)
    assert.match(source, /"\.\/index"/)
    assert.doesNotMatch(source, /absent|secret|apps\/demo|api\/src/)
    put('api/src/manifest.ts', 'export const modules = [] as const')
    assert.doesNotMatch(generateModuleComponents({ adminRoot: join(root, 'admin'), apiRoot: join(root, 'api') }), /catalog/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('invalid paired manifest fails rather than silently registering all pages', () => {
  const { generateModuleComponents } = require('../build/registry.cjs')
  assert.throws(() => generateModuleComponents({ adminRoot: tmpdir(), apiRoot: join(tmpdir(), 'missing-admin-api') }), /manifest/)
})
