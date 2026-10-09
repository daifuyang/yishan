import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyApiArtifact, pruneUninstalledModules } from '../package-api.mjs'

test('production module closure omits uninstalled code without changing source', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-package-prune-'))
  try {
    for (const module of ['demo', 'crm']) mkdirSync(join(root, 'dist/modules', module), { recursive: true })
    mkdirSync(join(root, 'src/modules/crm'), { recursive: true })
    pruneUninstalledModules(root, [{ id: 'demo' }])
    assert.equal(existsSync(join(root, 'dist/modules/demo')), true)
    assert.equal(existsSync(join(root, 'dist/modules/crm')), false)
    assert.equal(existsSync(join(root, 'src/modules/crm')), true)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('rejects an artifact with a missing exported runtime file', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-package-test-'))
  try {
    mkdirSync(join(root, 'dist'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@yishan/test-api', exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } } }))
    assert.throws(() => verifyApiArtifact(root), /missing.*export|export.*missing/i)
    writeFileSync(join(root, 'dist/index.js'), '')
    writeFileSync(join(root, 'dist/index.d.ts'), '')
    assert.doesNotThrow(() => verifyApiArtifact(root))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('rejects a deployment that can still reach workspace source through an external link', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-package-link-'))
  const outside = mkdtempSync(join(tmpdir(), 'yishan-package-source-'))
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@yishan/test-api' }))
    mkdirSync(join(root, 'node_modules'))
    symlinkSync(outside, join(root, 'node_modules/linked-source'), process.platform === 'win32' ? 'junction' : 'dir')
    assert.throws(() => verifyApiArtifact(root), /symlink escapes/)
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }) }
})

test('rejects environment files accidentally copied into a production package', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-package-env-'))
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@yishan/test-api' }))
    writeFileSync(join(root, '.env'), 'PLACEHOLDER=value')
    assert.throws(() => verifyApiArtifact(root), /environment file/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('rejects ordinary production dependencies missing from the artifact', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-package-dependency-'))
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@yishan/test-api', dependencies: { 'definitely-missing-yishan-dependency': '1.0.0' } }))
    assert.throws(() => verifyApiArtifact(root), /Cannot find module|Missing.*dependency/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('rejects third-party dependencies resolved from an ancestor instead of artifact closure', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-package-ancestor-'))
  const artifact = join(root, 'artifact')
  try {
    mkdirSync(join(root, 'node_modules/outside-runtime'), { recursive: true })
    mkdirSync(artifact)
    writeFileSync(join(root, 'node_modules/outside-runtime/package.json'), JSON.stringify({ name: 'outside-runtime', main: 'index.js' }))
    writeFileSync(join(root, 'node_modules/outside-runtime/index.js'), '')
    writeFileSync(join(artifact, 'package.json'), JSON.stringify({ name: '@yishan/test-api', dependencies: { 'outside-runtime': '1.0.0' } }))
    assert.throws(() => verifyApiArtifact(artifact), /Dependency resolves outside artifact/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
