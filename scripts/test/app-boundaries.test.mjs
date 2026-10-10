import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { collectAppBoundaryErrors } from '../check-app-boundaries.mjs'

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'yishan-app-boundaries-'))
  function pkg(location, manifest, source = '') {
    const directory = join(root, location)
    mkdirSync(join(directory, 'src'), { recursive: true })
    writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest))
    writeFileSync(join(directory, 'src/index.ts'), source)
  }
  try { run({ root, pkg }) } finally { rmSync(root, { recursive: true, force: true }) }
}
test('Core App and UI cannot depend on product packages', () => fixture(({ root, pkg }) => {
  pkg('apps/demo/config', { name: '@yishan/demo-config', exports: { '.': './src/index.ts' } })
  pkg('packages/core/app', { name: '@yishan/core-app', dependencies: { '@yishan/demo-config': 'workspace:*' } })
  pkg('packages/ui', { name: '@yishan/ui' }, "import config from '@yishan/demo-config'")
  assert.equal(collectAppBoundaryErrors(root).filter(error => error.includes('cannot depend on products')).length, 2)
}))
test('products consume public App exports and reject private or cross-workspace imports', () => fixture(({ root, pkg }) => {
  pkg('packages/core/app', { name: '@yishan/core-app', exports: { './request': './src/index.ts' } })
  pkg('apps/yishan-app', { name: 'yishan-app' }, "import request from '@yishan/core-app/request'")
  assert.deepEqual(collectAppBoundaryErrors(root), [])
  pkg('apps/yishan-app', { name: 'yishan-app' }, "import privateRequest from '@yishan/core-app/src/request'; import other from '../../../packages/core/app/src/index'")
  const errors = collectAppBoundaryErrors(root)
  assert.ok(errors.some(error => error.includes('public export')))
  assert.ok(errors.some(error => error.includes('relative import')))
}))
test('mobile packages cannot pull server or Admin runtimes into the bundle', () => fixture(({ root, pkg }) => {
  pkg('packages/core/app', { name: '@yishan/core-app' }, "import server from '@yishan/core-api'")
  assert.ok(collectAppBoundaryErrors(root).some(error => error.includes('server/Admin runtime')))
}))

test('build resolvers and SCSS must also use public exports', () => fixture(({ root, pkg }) => {
  pkg('packages/ui', { name: '@yishan/ui', exports: { './mobile': './src/index.ts' } })
  pkg('apps/yishan-app', { name: 'yishan-app' }, "const source = require.resolve('@yishan/ui/mobile/private')")
  writeFileSync(join(root, 'apps/yishan-app/src/index.scss'), "@use '@yishan/ui/mobile/private.scss';")
  assert.equal(collectAppBoundaryErrors(root).filter(error => error.includes('public export')).length, 2)
}))
