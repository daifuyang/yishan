import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
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
  pkg('apps/fixture/app', { name: '@yishan/fixture-app' }, "import request from '@yishan/core-app/request'")
  assert.deepEqual(collectAppBoundaryErrors(root), [])
  pkg('apps/fixture/app', { name: '@yishan/fixture-app' }, "import privateRequest from '@yishan/core-app/src/request'; import other from '../../../../packages/core/app/src/index'")
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
  pkg('apps/fixture/app', { name: '@yishan/fixture-app' }, "const source = require.resolve('@yishan/ui/mobile/private')")
  writeFileSync(join(root, 'apps/fixture/app/src/index.scss'), "@use '@yishan/ui/mobile/private.scss';")
  assert.equal(collectAppBoundaryErrors(root).filter(error => error.includes('public export')).length, 2)
}))

for (const location of ['packages/core/app', 'packages/ui', 'packages/yishan-tiptap']) {
  for (const kind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    test(`${location} rejects reverse product dependencies in ${kind}`, () => fixture(({ root, pkg }) => {
      pkg('apps/demo/config', { name: '@yishan/demo-config', exports: './src/index.ts' })
      pkg(location, { name: '@yishan/shared-fixture', [kind]: { '@yishan/demo-config': 'workspace:*' } })
      assert.ok(collectAppBoundaryErrors(root).some(error => error.includes('cannot depend on products')))
    }))
  }
  test(`${location} rejects product imports through relative and absolute paths`, () => fixture(({ root, pkg }) => {
    const target = join(root, 'apps/demo/config/src/index.ts')
    pkg('apps/demo/config', { name: '@yishan/demo-config', exports: './src/index.ts' })
    pkg(location, { name: '@yishan/shared-fixture' }, `import config from ${JSON.stringify(target)}`)
    assert.ok(collectAppBoundaryErrors(root).some(error => error.includes('cannot depend on products')))
    const depth = location.split('/').length + 1
    pkg(location, { name: '@yishan/shared-fixture' }, `import config from '${'../'.repeat(depth)}apps/demo/config/src/index'`)
    assert.ok(collectAppBoundaryErrors(root).some(error => error.includes('cannot depend on products')))
  }))
}

for (const kind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
  test(`App rejects cross-product ${kind} even when the target exports a public API`, () => fixture(({ root, pkg }) => {
    pkg('apps/other/config', { name: '@yishan/other-config', exports: './src/index.ts' })
    pkg('apps/demo/app', { name: '@yishan/demo-app', [kind]: { '@yishan/other-config': 'workspace:*' } })
    assert.ok(collectAppBoundaryErrors(root).some(error => error.includes('cross-product dependency')))
  }))
}

test('App rejects public, private, relative, Windows-separated and absolute cross-product imports', () => fixture(({ root, pkg }) => {
  pkg('apps/other/config', { name: '@yishan/other-config', exports: './src/index.ts' })
  const imports = ['@yishan/other-config', '@yishan/other-config/src/index', '../../../other/config/src/index', '..\\..\\..\\other\\config\\src\\index', join(root, 'apps/other/config/src/index.ts'), join(root, 'apps/other/config/src/index.ts').replaceAll('\\', '/')]
  for (const specifier of imports) {
    pkg('apps/demo/app', { name: '@yishan/demo-app' }, `import config from ${JSON.stringify(specifier)}`)
    assert.ok(collectAppBoundaryErrors(root).some(error => error.includes('cross-product dependency')), specifier)
  }
}))

test('App accepts its own product config, local aliases and public shared exports', () => fixture(({ root, pkg }) => {
  pkg('apps/demo/config', { name: '@yishan/demo-config', exports: './src/index.ts' })
  pkg('packages/core/app', { name: '@yishan/core-app', exports: { './request': './src/index.ts' } })
  pkg('apps/demo/app', { name: '@yishan/demo-app', dependencies: { '@yishan/demo-config': 'workspace:*', '@yishan/core-app': 'workspace:*' } }, "import config from '@yishan/demo-config'; import request from '@yishan/core-app/request'; import local from '@/local'; import sibling from './local'")
  assert.deepEqual(collectAppBoundaryErrors(root), [])
}))

test('relative imports in tests and escaped local aliases cannot bypass package exports', () => fixture(({ root, pkg }) => {
  pkg('packages/ui', { name: '@yishan/ui', exports: './src/index.ts' })
  pkg('apps/demo/app', { name: '@yishan/demo-app' }, "import ui from '@/../../../../packages/ui/src/index'")
  mkdirSync(join(root, 'apps/demo/app/tests'))
  writeFileSync(join(root, 'apps/demo/app/tests/index.cjs'), "require('../../../../packages/ui/src/index')")
  assert.equal(collectAppBoundaryErrors(root).filter(error => error.includes('relative import')).length, 2)
}))

test('absolute imports cannot bypass public exports', () => fixture(({ root, pkg }) => {
  pkg('packages/ui', { name: '@yishan/ui', exports: './src/index.ts' })
  pkg('apps/demo/app', { name: '@yishan/demo-app' }, `import ui from ${JSON.stringify(join(root, 'packages/ui/src/index.ts'))}`)
  assert.ok(collectAppBoundaryErrors(root).some(error => error.includes('absolute import')))
}))

test('mobile source and dependency paths cannot pull server or Admin runtimes', () => fixture(({ root, pkg }) => {
  pkg('packages/core/api', { name: '@yishan/core-api', exports: './src/index.ts' })
  pkg('packages/core/admin', { name: '@yishan/core-admin', exports: './src/index.ts' })
  pkg('apps/demo/app', { name: '@yishan/demo-app', optionalDependencies: { '@yishan/core-admin': 'workspace:*' } }, "import server from '../../../../packages/core/api/src/index'")
  assert.equal(collectAppBoundaryErrors(root).filter(error => error.includes('server/Admin runtime')).length, 2)
}))

for (const runtime of ['api', 'admin']) {
  test(`App cannot depend on its own product ${runtime} runtime`, () => fixture(({ root, pkg }) => {
    pkg(`apps/demo/${runtime}`, { name: `@yishan/demo-${runtime}`, exports: './src/index.ts' })
    pkg('apps/demo/app', { name: '@yishan/demo-app', devDependencies: { [`@yishan/demo-${runtime}`]: 'workspace:*' } }, `import runtime from '@yishan/demo-${runtime}'; import privateRuntime from '../../${runtime}/src/index'`)
    assert.equal(collectAppBoundaryErrors(root).filter(error => error.includes('server/Admin runtime')).length, 3)
  }))
}

test('file URL imports cannot bypass cross-product direction or public exports', () => fixture(({ root, pkg }) => {
  pkg('apps/other/config', { name: '@yishan/other-config', exports: './src/index.ts' })
  const url = pathToFileURL(join(root, 'apps/other/config/src/index.ts')).href
  pkg('apps/demo/app', { name: '@yishan/demo-app' }, `import(${JSON.stringify(url)})`)
  const errors = collectAppBoundaryErrors(root)
  assert.ok(errors.some(error => error.includes('cross-product dependency')))
  assert.ok(errors.some(error => error.includes('absolute import')))
}))

for (const [name, exports, allowed, denied] of [
  ['string', './src/index.ts', ['.'], ['./private']],
  ['missing exports', undefined, [], ['.', './private']],
  ['null root', null, [], ['.', './private']],
  ['array root', [null, './src/index.ts'], ['.'], ['./private']],
  ['conditional root', { types: './src/index.ts', import: './src/index.ts', require: './src/index.ts' }, ['.'], ['./private']],
  ['subpath conditions', { './request': { types: './src/index.ts', default: './src/index.ts' }, './blocked': { import: null, default: null } }, ['./request'], ['.', './blocked']],
  ['patterns with exact and more-specific null exclusions', { './mobile/*': './src/*.ts', './mobile/private/*': null, './mobile/exact': null }, ['./mobile/button'], ['.', './mobile/private/button', './mobile/exact']],
  ['patterns with suffixes', { './tokens/*.scss': './src/*.scss' }, ['./tokens/mobile.scss'], ['./tokens/mobile.css']],
]) {
  test(`public export checks support ${name}`, () => fixture(({ root, pkg }) => {
    pkg('packages/ui', { name: '@yishan/ui', exports })
    for (const subpath of [...allowed, ...denied]) {
      const specifier = '@yishan/ui' + (subpath === '.' ? '' : subpath.slice(1))
      pkg('apps/demo/app', { name: '@yishan/demo-app' }, `import ui from '${specifier}'`)
      const errors = collectAppBoundaryErrors(root)
      if (allowed.includes(subpath)) assert.deepEqual(errors, [], specifier)
      else assert.ok(errors.some(error => error.includes('public export')), specifier)
    }
  }))
}

for (const [filename, source] of [
  ['static.ts', "import value from '@yishan/ui/private'"],
  ['type.ts', "import type { Value } from '@yishan/ui/private'"],
  ['type-query.ts', "type Value = import('@yishan/ui/private').Value"],
  ['equals.ts', "import value = require('@yishan/ui/private')"],
  ['export.ts', "export { value } from '@yishan/ui/private'"],
  ['dynamic.mjs', "import('@yishan/ui/private', { with: { type: 'json' } })"],
  ['require.cjs', "require('@yishan/ui/private')"],
  ['resolve.js', "require.resolve('@yishan/ui/private', { paths: [] })"],
  ['template.jsx', 'import(`@yishan/ui/private`)'],
]) {
  test(`literal imports are checked in ${filename}`, () => fixture(({ root, pkg }) => {
    pkg('packages/ui', { name: '@yishan/ui', exports: './src/index.ts' })
    pkg('apps/demo/app', { name: '@yishan/demo-app' })
    writeFileSync(join(root, 'apps/demo/app/src', filename), source)
    assert.ok(collectAppBoundaryErrors(root).some(error => error.includes('public export')))
  }))
}

test('SCSS use, forward and every quoted import are checked while comments are ignored', () => fixture(({ root, pkg }) => {
  pkg('packages/ui', { name: '@yishan/ui', exports: { './mobile/tokens.scss': './src/tokens.scss' } })
  pkg('apps/demo/app', { name: '@yishan/demo-app' })
  writeFileSync(join(root, 'apps/demo/app/src/index.scss'), `
    /* @use '@yishan/ui/commented.scss'; */
    // @forward '@yishan/ui/commented.scss';
    .example { content: "@use '@yishan/ui/content.scss';"; }
    @use '@yishan/ui/mobile/tokens.scss';
    @forward '@yishan/ui/private.scss';
    @import '@yishan/ui/mobile/tokens.scss', '@yishan/ui/private.scss';
  `)
  assert.equal(collectAppBoundaryErrors(root).filter(error => error.includes('public export')).length, 2)
}))

test('CSS quoted url imports must use public exports', () => fixture(({ root, pkg }) => {
  pkg('packages/ui', { name: '@yishan/ui', exports: { './mobile/tokens.scss': './src/tokens.scss' } })
  pkg('apps/demo/app', { name: '@yishan/demo-app' })
  writeFileSync(join(root, 'apps/demo/app/src/index.css'), `
    @import url('@yishan/ui/private.css');
    @import url( "@yishan/ui/another-private.css" );
  `)
  const errors = collectAppBoundaryErrors(root)
  assert.equal(errors.filter(error => error.includes('public export')).length, 2)
  assert.ok(errors.some(error => error.includes('@yishan/ui/private.css')))
  assert.ok(errors.some(error => error.includes('@yishan/ui/another-private.css')))
}))

test('CSS url imports accept public exports and external HTTPS stylesheets', () => fixture(({ root, pkg }) => {
  pkg('packages/ui', { name: '@yishan/ui', exports: { './mobile/tokens.scss': './src/tokens.scss' } })
  pkg('apps/demo/app', { name: '@yishan/demo-app' })
  writeFileSync(join(root, 'apps/demo/app/src/index.css'), `
    @import url('@yishan/ui/mobile/tokens.scss');
    @import url('https://example.test/style.css');
    @import url("https://example.test/another-style.css") screen;
  `)
  assert.deepEqual(collectAppBoundaryErrors(root), [])
}))

test('computed Sass url imports are unsupported and are not resolved', () => fixture(({ root, pkg }) => {
  pkg('packages/ui', { name: '@yishan/ui', exports: './src/index.ts' })
  pkg('apps/demo/app', { name: '@yishan/demo-app' })
  writeFileSync(join(root, 'apps/demo/app/src/index.scss'), `
    @import url($stylesheet);
    @import url('@yishan/ui/#{$stylesheet}');
  `)
  assert.deepEqual(collectAppBoundaryErrors(root), [])
}))

test('computed dynamic imports and require arguments are unsupported and are not resolved', () => fixture(({ root, pkg }) => {
  pkg('packages/ui', { name: '@yishan/ui', exports: './src/index.ts' })
  pkg('apps/demo/app', { name: '@yishan/demo-app' }, "const subpath = 'private'; import('@yishan/ui/' + subpath); require(`@yishan/ui/${subpath}`); require.resolve(subpath)")
  assert.deepEqual(collectAppBoundaryErrors(root), [])
}))
