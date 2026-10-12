import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArguments, fixtureSources, copyOwnedSystemPackage } from './verify-admin-reuse.mjs'

test('reuse verifier accepts one installed module or two and rejects unknown modules', () => {
  assert.deepEqual(parseArguments(['--admin', 'apps/example/admin', '--modules', 'catalog,other']).combinations, [['catalog', 'other']])
  assert.deepEqual(parseArguments(['--admin', 'apps/example/admin', '--modules', 'catalog']).combinations, [['catalog']])
  assert.throws(() => parseArguments(['--modules', 'crm']), /catalog/)
})

test('System source probes mutate only an owned package copy while preserving public exports', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-admin-reuse-package-'))
  const source = join(root, 'source'), owned = join(root, 'owned')
  mkdirSync(join(source, 'src'), { recursive: true })
  mkdirSync(join(source, 'build'), { recursive: true })
  mkdirSync(join(source, 'node_modules'), { recursive: true })
  const manifest = { name: '@yishan/core-system-admin', files: ['src', 'build'], exports: { '.': './src/index.ts', './umi': './build/umi.cjs' } }
  writeFileSync(join(source, 'package.json'), JSON.stringify(manifest))
  writeFileSync(join(source, 'src/index.ts'), 'export const title = "original"')
  writeFileSync(join(source, 'build/umi.cjs'), 'exports.systemPages = {}')
  try {
    copyOwnedSystemPackage(source, owned)
    writeFileSync(join(owned, 'src/index.ts'), 'export const title = "HMR"')
    assert.equal(readFileSync(join(source, 'src/index.ts'), 'utf8'), 'export const title = "original"')
    assert.deepEqual(JSON.parse(readFileSync(join(owned, 'package.json'), 'utf8')).exports, manifest.exports)
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'yishan-admin-reuse-package-')))
    rmSync(root, { recursive: true, force: true })
  }
})

test('throwaway consumer uses public System exports and lazy generated registry without a Demo source dependency', () => {
  const files = fixtureSources(['catalog'])
  assert.match(files['admin/src/pages/index.tsx'], /lazy\(moduleComponentsMap\[key\]\)/)
  assert.match(files['admin/plugin.ts'], /@yishan\/core-system-admin\/umi/)
  assert.match(files['api/src/manifest.ts'], /\[catalog\]/)
  assert.doesNotMatch(files['api/src/manifest.ts'], /import.*other/)
  assert.ok(files['admin/src/modules/excluded/pages/index/index.tsx'])
  for (const text of Object.values(files)) assert.doesNotMatch(text, /apps\/demo|packages\/core|@yishan\/(?:core-admin|core-system-admin)\/src/)
})
