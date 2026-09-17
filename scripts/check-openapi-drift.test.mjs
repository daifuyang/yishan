import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = new URL('./check-openapi-drift.mjs', import.meta.url)

function git(cwd, ...args) {
  execFileSync('git', args, { cwd, stdio: 'ignore' })
}

function createRepository() {
  const cwd = mkdtempSync(join(tmpdir(), 'yishan-openapi-drift-'))
  git(cwd, 'init')
  git(cwd, 'config', 'user.email', 'test@example.com')
  git(cwd, 'config', 'user.name', 'Test User')
  writeFileSync(join(cwd, 'openapi.json'), '{"openapi":"3.0.3"}\n')
  git(cwd, 'add', 'openapi.json')
  git(cwd, 'commit', '-m', 'initial spec')
  return cwd
}

function run(cwd) {
  return spawnSync(process.execPath, [fileURLToPath(script), 'openapi.json'], {
    cwd,
    encoding: 'utf8',
  })
}

test('accepts a tracked OpenAPI spec without staged or unstaged drift', () => {
  const cwd = createRepository()
  try {
    const result = run(cwd)
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('rejects a tracked OpenAPI spec with unstaged drift', () => {
  const cwd = createRepository()
  try {
    writeFileSync(join(cwd, 'openapi.json'), '{"openapi":"3.1.0"}\n')
    const result = run(cwd)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /out of sync/)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
