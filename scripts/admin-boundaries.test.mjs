import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectAdminBoundaryErrors } from './check-admin-boundaries.mjs'

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'yishan-admin-boundaries-'))
  const write = (file, text) => {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  const pkg = (directory, name, extra = {}) => {
    write(`${directory}/package.json`, JSON.stringify({ name, exports: { '.': './src/index.ts', './public/*': './src/public/*.ts' }, ...extra }))
    write(`${directory}/src/index.ts`, '')
  }
  pkg('packages/core/admin', '@yishan/core-admin')
  pkg('packages/core/system-admin', '@yishan/core-system-admin')
  pkg('apps/demo/admin', '@yishan/demo-admin')
  pkg('apps/other/admin', '@company/other-admin')
  try { run({ root, write, pkg }) } finally { rmSync(root, { recursive: true, force: true }) }
}

test('public source exports are allowed; unexported and relative private access fail', () => fixture(({ root, write }) => {
  write('apps/demo/admin/src/index.ts', "import { x } from '@yishan/core-admin'; export * from '@yishan/core-admin/public/extension'")
  assert.deepEqual(collectAdminBoundaryErrors(root), [])
  for (const source of [
    "import x from '@yishan/core-admin/src/internal'",
    "export * from '../../../../packages/core/admin/src/internal'",
    "const x = require('@yishan/core-admin/private')",
    "const x = import(`@yishan/core-admin/private`)",
  ]) {
    write('apps/demo/admin/src/index.ts', source)
    assert.match(collectAdminBoundaryErrors(root).join('\n'), /public export/)
  }
}))

test('Core Admin cannot import products through source or any dependency declaration', () => fixture(({ root, write, pkg }) => {
  for (const source of ["import x from '@yishan/demo-admin'", "export * from '@company/other-admin'", "const x = require('@yishan/demo-admin')", "const x = import('@yishan/demo-admin')"]) {
    write('packages/core/admin/src/index.ts', source)
    assert.match(collectAdminBoundaryErrors(root).join('\n'), /Core cannot depend on products/)
  }
  for (const kind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    pkg('packages/core/admin', '@yishan/core-admin', { [kind]: { '@yishan/demo-admin': 'workspace:*' } })
    assert.match(collectAdminBoundaryErrors(root).join('\n'), /Core cannot depend on products/)
  }
}))

test('products cannot cross products in imports or manifests, including config files', () => fixture(({ root, write, pkg }) => {
  write('apps/demo/admin/config/config.ts', "import x from '@company/other-admin'")
  assert.match(collectAdminBoundaryErrors(root).join('\n'), /cross-product/)
  write('apps/demo/admin/config/config.ts', '')
  pkg('apps/demo/admin', '@yishan/demo-admin', { dependencies: { '@company/other-admin': 'workspace:*' } })
  assert.match(collectAdminBoundaryErrors(root).join('\n'), /cross-product/)
}))

test('Core Admin cannot reverse into System Admin or consume backend runtime packages', () => fixture(({ root, write, pkg }) => {
  pkg('packages/core/api', '@yishan/core-api')
  for (const target of ['@yishan/core-system-admin', '@yishan/core-api']) {
    write('packages/core/admin/src/index.ts', `import x from '${target}'`)
    assert.match(collectAdminBoundaryErrors(root).join('\n'), /forbidden dependency/)
  }
  write('packages/core/admin/src/index.ts', '')
  write('packages/core/system-admin/src/index.ts', "import x from '@yishan/core-admin'")
  assert.deepEqual(collectAdminBoundaryErrors(root), [])
}))

test('generated and dependency directories are ignored, but generated service source is checked', () => fixture(({ root, write }) => {
  write('apps/demo/admin/src/.umi/plugin.ts', "import x from '@company/other-admin'")
  write('apps/demo/admin/node_modules/example/index.js', "import x from '@company/other-admin'")
  assert.deepEqual(collectAdminBoundaryErrors(root), [])
  write('apps/demo/admin/src/services/generated/test.ts', "import x from '@company/other-admin'")
  assert.match(collectAdminBoundaryErrors(root).join('\n'), /cross-product/)
}))

test('specific null export exclusions and TypeScript import types cannot expose private source', () => fixture(({ root, write, pkg }) => {
  pkg('packages/core/admin', '@yishan/core-admin', { exports: { '.': './src/index.ts', './public/*': './src/public/*.ts', './public/private/*': null } })
  write('apps/demo/admin/src/index.ts', "type Public = import('@yishan/core-admin/public/extension').Public")
  assert.deepEqual(collectAdminBoundaryErrors(root), [])
  write('apps/demo/admin/src/index.ts', "type Private = import('@yishan/core-admin/public/private/token').Private")
  assert.match(collectAdminBoundaryErrors(root).join('\n'), /public export/)
}))

test('checks the Core source build plugin while ignoring product build output', () => fixture(({ root, write }) => {
  write('apps/demo/admin/build/output.js', "const x = require('@company/other-admin')")
  assert.deepEqual(collectAdminBoundaryErrors(root), [])
  write('packages/core/admin/build/plugin.cjs', "const x = require('@yishan/demo-admin')")
  assert.match(collectAdminBoundaryErrors(root).join('\n'), /Core cannot depend on products/)
}))
