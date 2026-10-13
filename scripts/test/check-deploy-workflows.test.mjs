import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const SCRIPT = join(import.meta.dirname, '..', 'check-deploy-workflows.mjs')

/** 在临时仓库里放一组工作流，跑守卫并返回它报出的问题编号 */
function check(files) {
  const root = mkdtempSync(join(tmpdir(), 'wf-test-'))
  try {
    const dir = join(root, '.github', 'workflows')
    mkdirSync(dir, { recursive: true })
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
    // 守卫把 .github/workflows 解析为相对仓库根目录，故以 cwd 运行
    let out = ''
    try {
      execFileSync(process.execPath, [SCRIPT], { cwd: root, stdio: 'pipe', env: { ...process.env, DEPLOY_WORKFLOWS_DIR: dir } })
    } catch (error) {
      out = String(error.stderr)
    }
    return out.split('\n').filter(Boolean)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const VALID_DEPLOY = `name: yishan-demo-cd
on:
  push:
    branches:
      - main
    paths:
      - ".github/workflows/yishan-demo-cd.yml"
  workflow_dispatch:
    inputs:
      skip_ci_gate:
        default: false
        type: boolean
jobs:
  ci-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Require green CI
        run: |
          echo "waiting for yishan-fullstack-ci"
  deploy:
    needs: ci-gate
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: |
          set -euo pipefail
          s deploy -y -t templates/function.yaml
`

test('守卫对仓库自带的发布工作流零告警', () => {
  assert.equal(
    execFileSync(process.execPath, [SCRIPT], { stdio: 'pipe' }).toString().trim(),
    'deploy workflows verified',
  )
})

test('引用了不存在的工作流会被报出来', () => {
  const out = check({
    'a.yml': `name: a\non:\n  workflow_dispatch:\njobs:\n  x:\n    steps:\n      - run: echo ".github/workflows/missing.yml"\n`,
    'b.yml': `name: b\non:\n  workflow_dispatch:\njobs:\n  x:\n    steps:\n      - run: echo hi\n`,
  })
  assert.ok(out.some((l) => l.startsWith('missing-workflow|a.yml|missing.yml')), out.join('\n'))
})

test('同名工作流会被报出来（后者会覆盖前者）', () => {
  const out = check({
    'a.yml': `name: same\non:\n  workflow_dispatch:\njobs:\n  x:\n    steps:\n      - run: echo hi\n`,
    'b.yml': `name: same\non:\n  workflow_dispatch:\njobs:\n  x:\n    steps:\n      - run: echo hi\n`,
  })
  assert.ok(out.some((l) => l.startsWith('duplicate-name|')), out.join('\n'))
})

test('没有触发器的工作流会被报出来', () => {
  const out = check({ 'a.yml': `name: a\non:\n  push:\n    branches:\n      - main\njobs:\n  x:\n    steps:\n      - run: echo hi\n` })
  // 推 main 但没有 workflow_dispatch：日常只能靠 push，缺少人工重发入口
  assert.ok(out.some((l) => l.startsWith('no-manual-trigger|a.yml')), out.join('\n'))
})

test('发布作业绕过 CI 门禁会被报出来', () => {
  const out = check({
    'yishan-x-cd.yml': `name: yishan-x-cd
on:
  push:
    branches:
      - main
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: |
          s deploy -y -t templates/function.yaml
`,
  })
  assert.ok(out.some((l) => l.startsWith('no-ci-gate|')), out.join('\n'))
})

test('skip_ci_gate 默认为 true 会被报出来', () => {
  const out = check({
    'yishan-x-cd.yml': `name: yishan-x-cd
on:
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      skip_ci_gate:
        default: true
        type: boolean
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: |
          s deploy -y -t templates/function.yaml
`,
  })
  assert.ok(out.some((l) => l.startsWith('skip-gate-default|')), out.join('\n'))
})

test('run 块里的 bash 语法错误会被报出来', () => {
  const out = check({
    'yishan-x-cd.yml': `name: yishan-x-cd
on:
  push:
    branches:
      - main
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: |
          set -euo pipefail
          if [ 1 -eq 1 ; then
`,
  })
  assert.ok(out.some((l) => l.startsWith('shell-syntax|')), out.join('\n'))
})

test('未闭合的 heredoc 会被报出来', () => {
  const out = check({
    'yishan-x-cd.yml': `name: yishan-x-cd
on:
  push:
    branches:
      - main
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: |
          cat > cfg <<'CFG'
          {"current":"x"}
`,
  })
  assert.ok(out.some((l) => l.startsWith('unbalanced-heredoc|')), out.join('\n'))
})

test('结构正确的工作流不产生告警', () => {
  const out = check({ 'yishan-demo-cd.yml': VALID_DEPLOY, 'yishan-fullstack-ci.yml': `name: yishan-fullstack-ci\non:\n  push:\n    paths:\n      - "x"\njobs:\n  verify:\n    steps:\n      - run: echo hi\n` })
  assert.deepEqual(out, [], out.join('\n'))
})