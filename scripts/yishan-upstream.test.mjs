import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'yishan-upstream.mjs')
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(tmpdir(), 'yishan-upstream-test.gitconfig'),
}
writeFileSync(env.GIT_CONFIG_GLOBAL, '[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n')
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()
const write = (root, rel, content) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), content)
}
const run = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env, encoding: 'utf8' })

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'yishan-upstream-'))
  const up = join(root, 'upstream')
  const me = join(root, 'consumer')
  mkdirSync(up)
  mkdirSync(me)
  git(up, 'init', '-q')
  write(up, 'apps/yishan-api/src/kernel.ts', 'export const a = 1\nexport const b = 2\nexport const c = 3\n')
  write(up, 'apps/yishan-api/src/message.ts', 'export const locked = "locked: contact admin"\n')
  write(up, 'apps/yishan-api/src/modules/demo/index.ts', 'export const demo = 1\n')
  git(up, 'add', '-A')
  git(up, 'commit', '-q', '-m', 'v1')
  const base = git(up, 'rev-parse', 'HEAD')

  git(me, 'init', '-q')
  write(me, 'server/src/kernel.ts', 'export const a = 1\nexport const b = 2\nexport const c = 3\nexport const mine = true\n')
  write(me, 'server/src/message.ts', 'export const locked = "locked: call the IT desk"\n')
  write(me, 'YISHAN_UPSTREAM.json', JSON.stringify({ repo: up, base, pathMap: { 'apps/yishan-api': 'server' }, exclude: ['apps/yishan-api/src/modules/demo'] }, null, 2))
  git(me, 'add', '-A')
  git(me, 'commit', '-q', '-m', 'import')

  write(up, 'apps/yishan-api/src/kernel.ts', 'export const a = 10\nexport const b = 2\nexport const c = 3\n')
  write(up, 'apps/yishan-api/src/message.ts', 'export const locked = "locked: ask an administrator"\n')
  write(up, 'apps/yishan-api/src/added.ts', 'export const added = 1\n')
  write(up, 'apps/yishan-api/src/modules/demo/index.ts', 'export const demo = 2\n')
  git(up, 'add', '-A')
  git(up, 'commit', '-q', '-m', 'v2')
  return { root, up, me, base, target: git(up, 'rev-parse', 'HEAD') }
}

test('status previews changes, flags local customisations and honours exclude', () => {
  const t = setup()
  try {
    const r = run(t.me, 'status')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /M server\/src\/kernel\.ts {2}<- modified locally/)
    assert.match(r.stdout, /A server\/src\/added\.ts/)
    assert.doesNotMatch(r.stdout, /modules\/demo/)
  } finally {
    rmSync(t.root, { recursive: true, force: true })
  }
})

test('apply merges three-way, never overwrites local edits, and rolls back cleanly', () => {
  const t = setup()
  try {
    write(t.me, 'server/src/kernel.ts', 'dirty\n')
    assert.equal(run(t.me, 'apply').status, 1, 'refuses a dirty tree')
    git(t.me, 'checkout', '--', '.')

    const r = run(t.me, 'apply')
    assert.equal(r.status, 2, r.stdout + r.stderr)
    assert.equal(git(t.me, 'branch', '--show-current'), `yishan-upgrade/${t.target.slice(0, 12)}`)
    const kernel = readFileSync(join(t.me, 'server/src/kernel.ts'), 'utf8')
    assert.match(kernel, /export const a = 10/)
    assert.match(kernel, /export const mine = true/)
    const message = readFileSync(join(t.me, 'server/src/message.ts'), 'utf8')
    assert.match(message, /<<<<<<<[\s\S]*IT desk[\s\S]*=======[\s\S]*administrator[\s\S]*>>>>>>>/)
    assert.ok(existsSync(join(t.me, 'server/src/added.ts')))
    assert.equal(JSON.parse(readFileSync(join(t.me, 'YISHAN_UPSTREAM.json'), 'utf8')).base, t.target)

    git(t.me, 'reset', '-q', '--hard')
    git(t.me, 'switch', '-q', 'main')
    git(t.me, 'branch', '-q', '-D', `yishan-upgrade/${t.target.slice(0, 12)}`)
    assert.equal(git(t.me, 'status', '--porcelain'), '')
    assert.match(readFileSync(join(t.me, 'server/src/message.ts'), 'utf8'), /IT desk/)
    assert.equal(JSON.parse(readFileSync(join(t.me, 'YISHAN_UPSTREAM.json'), 'utf8')).base, t.base)
  } finally {
    rmSync(t.root, { recursive: true, force: true })
  }
})

test('a patch that cannot apply leaves the repository untouched', () => {
  const t = setup()
  try {
    git(t.me, 'rm', '-q', 'server/src/kernel.ts')
    git(t.me, 'commit', '-q', '-m', 'drop kernel without excluding it')
    const head = git(t.me, 'rev-parse', 'HEAD')
    const r = run(t.me, 'apply')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /nothing was changed/)
    assert.equal(git(t.me, 'rev-parse', 'HEAD'), head)
    assert.equal(git(t.me, 'branch', '--show-current'), 'main')
    assert.equal(git(t.me, 'branch', '--list', 'yishan-upgrade/*'), '')
    assert.equal(git(t.me, 'status', '--porcelain'), '')
  } finally {
    rmSync(t.root, { recursive: true, force: true })
  }
})
