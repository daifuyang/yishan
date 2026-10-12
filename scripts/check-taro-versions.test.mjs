import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./check-taro-versions.mjs', import.meta.url))

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'yishan-taro-versions-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  function manifest(location, data) {
    mkdirSync(join(root, location), { recursive: true })
    writeFileSync(join(root, location, 'package.json'), JSON.stringify(data))
  }
  const app = 'apps/demo/app'
  manifest(app, { dependencies: {
    '@tarojs/taro': '^4.0.0', '@tarojs/react': 'file:./scripts/tarojs-react-shim',
  }, devDependencies: { '@tarojs/cli': '^4.0.0', 'babel-preset-taro': '^4.0.0' } })
  manifest('packages/core/app', { peerDependencies: { '@tarojs/taro': '^4.0.0' } })
  manifest('packages/ui', { peerDependencies: { '@tarojs/components': '^4.0.0' } })
  for (const name of ['@tarojs/taro', '@tarojs/react', '@tarojs/cli', 'babel-preset-taro']) {
    manifest(`${app}/node_modules/${name}`, { name, version: '4.2.0' })
  }
  manifest('packages/core/app/node_modules/@tarojs/taro', { name: '@tarojs/taro', version: '4.2.0' })
  manifest('packages/ui/node_modules/@tarojs/components', { name: '@tarojs/components', version: '4.2.0' })
  return { root, manifest, run: () => spawnSync(process.execPath, [script, root], { encoding: 'utf8' }) }
}

test('accepts aligned installed Taro packages despite broad declared ranges and a local shim', t => {
  const { run } = fixture(t)
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /4\.2\.0/)
})

for (const [location, name] of [
  ['apps/demo/app', '@tarojs/taro'],
  ['apps/demo/app', '@tarojs/react'],
  ['apps/demo/app', 'babel-preset-taro'],
  ['packages/core/app', '@tarojs/taro'],
  ['packages/ui', '@tarojs/components'],
]) {
  test(`rejects installed version drift in ${location}/${name}`, t => {
    const { manifest, run } = fixture(t)
    manifest(`${location}/node_modules/${name}`, { name, version: '4.1.9' })
    const result = run()
    assert.equal(result.status, 1)
    assert.ok(result.stderr.includes(`${location}: ${name}`), result.stderr)
    assert.match(result.stderr, /4\.1\.9.*4\.2\.0/)
  })
}

test('rejects a missing installed package rather than trusting its manifest range', t => {
  const { root, run } = fixture(t)
  rmSync(join(root, 'apps/demo/app/node_modules/@tarojs/taro'), { recursive: true })
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /@tarojs\/taro.*not installed/)
})

test('rejects an unsupported CLI major even when the package manifest declares Taro 4', t => {
  const { manifest, run } = fixture(t)
  manifest('apps/demo/app/node_modules/@tarojs/cli', { name: '@tarojs/cli', version: '5.0.0' })
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Taro 4.*5\.0\.0/)
})
