import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const script = join(root, 'scripts/verify-tiptap-consumer.mjs')
function verify(output) {
  return spawnSync(process.execPath, [script, '--output', output], {
    encoding: 'utf8', env: { ...process.env, npm_execpath: join(root, 'unused-pnpm.cjs') },
  })
}
test('consumer verification refuses repository directories, including misleading dot-dot prefixes', () => {
  for (const directory of [root, join(root, '..consumer-fixture')]) {
    const result = verify(directory)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /outside the repository/)
  }
  assert.equal(existsSync(join(root, '..consumer-fixture')), false)
})
test('consumer verification never overwrites an existing external directory', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tiptap-owned-fixture-'))
  try {
    const result = verify(directory)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /EEXIST/)
    assert.equal(existsSync(directory), true)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
