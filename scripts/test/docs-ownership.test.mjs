import assert from 'node:assert/strict'
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {collectAppBoundaryErrors} from '../check-app-boundaries.mjs'

const root = join(import.meta.dirname, '../..')

function fixture(run) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'yishan-docs-ownership-'))
  const pkg = (location, manifest, source = '') => {
    const directory = join(fixtureRoot, location)
    mkdirSync(join(directory, 'src'), {recursive: true})
    writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest))
    writeFileSync(join(directory, 'src/index.ts'), source)
  }
  try { run({root: fixtureRoot, pkg}) } finally { rmSync(fixtureRoot, {recursive: true, force: true}) }
}

test('product and portal Docs packages expose independent build entry points', () => {
  for (const [location, name] of [
    ['apps/demo/docs', '@yishan/demo-docs'],
    ['apps/portal/docs', '@yishan/portal-docs'],
  ]) {
    const manifest = JSON.parse(readFileSync(join(root, location, 'package.json'), 'utf8'))
    assert.equal(manifest.name, name)
    assert.equal(typeof manifest.scripts.build, 'string')
    assert.ok(manifest.dependencies['@yishan/docs-kit'])
  }
})

test('Docs kit is content-free and exposes shared configuration and components', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'packages/core/docs-kit/package.json'), 'utf8'))
  assert.equal(manifest.name, '@yishan/docs-kit')
  assert.ok(manifest.exports['./config'])
  assert.ok(manifest.exports['./components/FeatureGrid'])
  assert.equal(existsSync(join(root, 'packages/core/docs-kit/content')), false)
})

test('Docs boundary allows each product Docs app to consume docs-kit', () => {
  const errors = collectAppBoundaryErrors(root)
  assert.deepEqual(errors, [])
})

test('Docs kit cannot depend on a product and product Docs cannot import another product Docs', () => fixture(({root: fixturePkg, pkg}) => {
  pkg('packages/core/docs-kit', {name: '@yishan/docs-kit'}, "import config from '@yishan/demo-config'")
  pkg('apps/demo/config', {name: '@yishan/demo-config', exports: './src/index.ts'})
  pkg('apps/demo/docs', {name: '@yishan/demo-docs'}, "import crm from '@yishan/crm-docs'")
  pkg('apps/crm/docs', {name: '@yishan/crm-docs', exports: './src/index.ts'})
  const errors = collectAppBoundaryErrors(fixturePkg)
  assert.ok(errors.some(error => error.includes('shared packages cannot depend on products')))
  assert.ok(errors.some(error => error.includes('cross-product dependency')))
}))
