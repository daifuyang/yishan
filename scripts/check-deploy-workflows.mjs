#!/usr/bin/env node
/**
 * check-deploy-workflows.mjs — 发布工作流的静态守卫（不联网、不部署）。
 *
 * 工作流只在推 main 时真正跑，出错要等十几分钟才暴露。这里把最容易踩的几类
 * 问题提前到 CI 里挡住：
 *
 *   missing-workflow   .github/workflows/ 里存在引用了但并不存在的文件
 *   duplicate-name     两个工作流同名（后写的会覆盖先写的）
 *   no-trigger         没有 push:main 或 workflow_dispatch，等于永远不发布
 *   no-ci-gate         缺 CI 门禁步骤：未经 CI 的 commit 也能进生产
 *   skip-gate-default  skip_ci_gate 的默认值不是 false，等于默认跳过门禁
 *   shell-syntax       run 块不是合法 bash（只做 bash -n 级别的语法检查）
 *   unbalanced-heredoc run 块里的 heredoc 没有闭合
 *
 * 用法：node scripts/check-deploy-workflows.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
// 允许测试指向临时目录；正常使用时固定为仓库内的 .github/workflows。
const DIR = process.env.DEPLOY_WORKFLOWS_DIR || join(ROOT, '.github', 'workflows')

/** 这些工作流不发布东西，不要求 push 触发和 CI 门禁 */
const SCHEDULE_ONLY = new Set(['yishan-h5-cert-rotate.yml', 'yishan-cert-rotate-fc.yml'])
const MANUAL_ONLY = new Set(['yishan-fc-migrate.yml'])
/** 持续集成工作流：只跑检查、不发布，不需要 push:main 触发，也不需要自身过 CI 门禁 */
const CI_ONLY = new Set(['yishan-fullstack-ci.yml'])

const problems = []

function parse(text) {
  // 工作流 YAML 结构简单：顶层键缩进 0，jobs 下的键缩进 2，steps 缩进 4。
  const lines = text.split('\n')
  const top = new Map()
  lines.forEach((line, i) => {
    const m = /^([A-Za-z_][\w-]*):(.*)$/.exec(line)
    if (m) top.set(m[1], { value: m[2].trim(), line: i })
  })
  return { lines, top }
}

function jobBlocks(lines) {
  const jobs = new Map()
  let name = null
  let body = []
  for (const line of lines) {
    const m = /^ {2}([A-Za-z_][\w-]*):\s*$/.exec(line)
    if (m) {
      if (name) jobs.set(name, body)
      name = m[1]
      body = []
      continue
    }
    if (name) body.push(line)
  }
  if (name) jobs.set(name, body)
  return jobs
}

function hasHeredocMismatch(step) {
  const opens = [...step.matchAll(/<<-?\s*'?([A-Za-z_][\w]*)'?/g)].map((m) => m[1])
  for (const tag of opens) {
    const closed = step.split('\n').some((l) => l.trim() === tag)
    if (!closed) return tag
  }
  return null
}

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort()) {
  const text = readFileSync(join(DIR, file), 'utf8')
  const { lines } = parse(text)

  // 重复的工作流名会让后写的悄悄覆盖先写的
  const nameLine = lines.find((l) => /^name:/.test(l))
  const wfName = nameLine?.slice('name:'.length).trim()
  if (wfName) {
    for (const other of readdirSync(DIR)) {
      if (other <= file) continue
      const otherText = readFileSync(join(DIR, other), 'utf8')
      const otherName = otherText.split('\n').find((l) => /^name:/.test(l))?.slice('name:'.length).trim()
      if (otherName && otherName === wfName) problems.push(`duplicate-name|${file}|${other}|${wfName}`)
    }
  }

  // 被引用但不存在的文件
  for (const m of text.matchAll(/\.github\/workflows\/([\w.-]+\.ya?ml)/g)) {
    if (m[1] !== file && !readdirSync(DIR).includes(m[1])) {
      problems.push(`missing-workflow|${file}|${m[1]}`)
    }
  }

  // 发布类工作流必须有触发方式
  const isManual = MANUAL_ONLY.has(file)
  // 缩进随 paths/branches 层级变化（实际是 6 空格），只按行尾内容匹配。
  const pushesMain = /^\s+- main$/m.test(text) && /^ {2}push:$/m.test(text)
  const hasDispatch = /^ {2}workflow_dispatch:/m.test(text)
  const isSchedule = /^ {2}schedule:$/m.test(text)
  if (!isManual && !SCHEDULE_ONLY.has(file) && !CI_ONLY.has(file) && !pushesMain && !hasDispatch) {
    problems.push(`no-trigger|${file}`)
  }
  if (pushesMain && !isManual && !SCHEDULE_ONLY.has(file) && !CI_ONLY.has(file) && !hasDispatch && !isSchedule) {
    problems.push(`no-manual-trigger|${file}`)
  }

  const jobs = jobBlocks(lines)

  // 需要发布的作业必须过 CI 门禁
  for (const [jobName, body] of jobs) {
    const bodyText = body.join('\n')
    const publishes = /s deploy|qupload2|db:migrate --apply/.test(bodyText)
    if (!publishes) continue
    if (SCHEDULE_ONLY.has(file) || isManual || CI_ONLY.has(file)) continue
    if (!jobName.includes('deploy')) continue
    if (!/yishan-fullstack-ci/.test(bodyText) && !/needs:.*ci-gate/.test(bodyText)) {
      problems.push(`no-ci-gate|${file}|${jobName}`)
    }
  }

  // skip_ci_gate 的默认值是门禁底线：默认 true 等于默认不检查 CI。
  // 它声明在工作流级的 on.workflow_dispatch.inputs 下，不在任何 job 里。
  if (/skip_ci_gate:[\s\S]{0,220}?default:\s*true/.test(text)) {
    problems.push(`skip-gate-default|${file}`)
  }

  // 每个 run 块：heredoc 闭合 + bash 语法
  const scratch = mkdtempSync(join(tmpdir(), 'wf-'))
  try {
    lines.forEach((line, i) => {
      const m = /^ {6,10}run: \|/.exec(line)
      if (!m) return
      const indent = line.length - line.trimStart().length
      const body = []
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j]
        if (l.trim() === '') { body.push(''); continue }
        if (l.length - l.trimStart().length <= indent) break
        body.push(l)
      }
      const step = body.join('\n')
      const tag = hasHeredocMismatch(step)
      if (tag) {
        problems.push(`unbalanced-heredoc|${file}|line ${i + 2}|${tag}`)
        return
      }
      const file2 = join(scratch, `step-${i}.sh`)
      writeFileSync(file2, step)
      try {
        execFileSync('bash', ['-n', file2], { stdio: 'pipe' })
      } catch (error) {
        problems.push(`shell-syntax|${file}|line ${i + 2}|${String(error.stderr).split('\n')[2]?.trim() ?? 'syntax error'}`)
      }
    })
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (problems.length) {
  for (const p of problems) console.error(p)
  console.error(`\n${problems.length} workflow problem(s)`)
  process.exit(1)
}
console.log('deploy workflows verified')