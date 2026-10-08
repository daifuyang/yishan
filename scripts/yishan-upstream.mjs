#!/usr/bin/env node
/**
 * yishan-upstream.mjs — 下游项目跟进 Yishan 上游源码的薄封装（只编排 Git 命令，无其他依赖）。
 *
 * 下游把本文件复制进自己的仓库，并在仓库根目录维护来源标记 YISHAN_UPSTREAM.json：
 *   {
 *     "repo": "https://github.com/daifuyang/yishan.git",   // 上游地址（URL 或本地路径）
 *     "base": "<上次同步到的上游 commit>",
 *     "pathMap": { "apps/yishan-api": "server" },            // 上游路径 → 本仓库路径
 *     "exclude": ["apps/yishan-api/src/modules/demo"]        // 已删除或接管、不再跟进的上游路径
 *   }
 *
 *   node scripts/yishan-upstream.mjs status [--to <ref>]   预览：上游提交、变更文件，以及本地也改过的文件（冲突风险）
 *   node scripts/yishan-upstream.mjs diff   [--to <ref>]   输出将要应用的补丁（已按 pathMap/exclude 过滤）
 *   node scripts/yishan-upstream.mjs apply  [--to <ref>]   在新分支上三方合并并更新标记；无冲突则单提交
 *
 * 保证：只在干净工作区运行；只在新分支 `yishan-upgrade/<sha>` 上修改；`git apply --3way`
 * 对本地改过的文件产生冲突标记而不是覆盖；标记文件与代码在同一提交中更新。
 * 回滚：切回原分支并删除升级分支（未合并时），或 `git revert` 升级提交（已合并时）。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const MARKER = 'YISHAN_UPSTREAM.json'

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts })
const gitOk = (args) => spawnSync('git', args, { encoding: 'utf8' }).status === 0

function loadMarker() {
  if (!existsSync(MARKER)) throw new Error(`${MARKER} not found in ${process.cwd()} (run from the repository root)`)
  const m = JSON.parse(readFileSync(MARKER, 'utf8'))
  for (const k of ['repo', 'base', 'pathMap']) if (!m[k]) throw new Error(`${MARKER}: missing "${k}"`)
  if (!Array.isArray(m.exclude)) m.exclude = []
  return m
}

/** 取上游目标提交，并确保 base 也在本地对象库中（三方合并需要基线 blob）。 */
function fetchTarget(marker, to) {
  git(['fetch', '--quiet', '--no-tags', marker.repo, to])
  const target = git(['rev-parse', 'FETCH_HEAD^{commit}']).trim()
  if (!gitOk(['cat-file', '-e', `${marker.base}^{commit}`])) git(['fetch', '--quiet', '--no-tags', marker.repo, marker.base])
  return target
}

const excludes = (marker, src) =>
  marker.exclude.filter((e) => e === src || e.startsWith(`${src}/`)).map((e) => `:(exclude)${e}`)

/** 按映射生成过滤后的补丁：上游 src 前缀被去掉，应用时用 --directory=dest 加回。 */
function patchFor(marker, target, src) {
  return git(['diff', '--binary', '--full-index', '--no-renames', `--relative=${src}`, marker.base, target, '--', src, ...excludes(marker, src)])
}

function changedFiles(marker, target, src) {
  const out = git(['diff', '--name-status', '--no-renames', marker.base, target, '--', src, ...excludes(marker, src)])
  return out.split('\n').filter(Boolean).map((l) => {
    const [status, path] = l.split('\t')
    return { status, path, local: `${marker.pathMap[src]}${path.slice(src.length)}` }
  })
}

/** 本地文件是否偏离了上游基线（即下游做过定制）。 */
function locallyModified(marker, upstreamPath, localPath) {
  const baseBlob = spawnSync('git', ['rev-parse', `${marker.base}:${upstreamPath}`], { encoding: 'utf8' })
  if (baseBlob.status !== 0) return existsSync(localPath)
  if (!existsSync(localPath)) return true
  const localBlob = git(['hash-object', localPath]).trim()
  return localBlob !== baseBlob.stdout.trim()
}

function status(marker, target) {
  console.log(`upstream ${marker.repo}\nbase     ${marker.base}\ntarget   ${target}`)
  if (target === marker.base) return console.log('already up to date')
  for (const src of Object.keys(marker.pathMap)) {
    const log = git(['log', '--oneline', '--no-decorate', `${marker.base}..${target}`, '--', src, ...excludes(marker, src)]).trim()
    console.log(`\n[${src} -> ${marker.pathMap[src]}] commits:\n${log || '  (none)'}`)
    for (const f of changedFiles(marker, target, src)) {
      const risk = f.status !== 'A' && locallyModified(marker, f.path, f.local) ? '  <- modified locally: 3-way merge, may conflict' : ''
      console.log(`  ${f.status} ${f.local}${risk}`)
    }
  }
}

function apply(marker, target) {
  if (git(['status', '--porcelain']).trim()) throw new Error('working tree is not clean; commit or stash first')
  if (target === marker.base) return console.log('already up to date')
  const original = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  const branch = `yishan-upgrade/${target.slice(0, 12)}`
  git(['switch', '--quiet', '-c', branch])
  let conflicted = false
  for (const [src, dest] of Object.entries(marker.pathMap)) {
    const patch = patchFor(marker, target, src)
    if (!patch.trim()) continue
    const r = spawnSync('git', ['apply', '--3way', '--whitespace=nowarn', `--directory=${dest}`], { input: patch, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    process.stdout.write(r.stdout)
    process.stderr.write(r.stderr)
    if (r.status !== 0) {
      const unmerged = git(['diff', '--name-only', '--diff-filter=U']).trim()
      if (!unmerged) {
        // 补丁整体无法应用（例如本地删除了上游仍在修改的文件）：不留下半成品。
        git(['reset', '--quiet', '--hard'])
        git(['switch', '--quiet', original])
        git(['branch', '--quiet', '-D', branch])
        throw new Error(`patch for ${src} does not apply; nothing was changed. Add deleted/taken-over paths to "exclude" or port the change manually.`)
      }
      conflicted = true
    }
  }
  writeFileSync(MARKER, `${JSON.stringify({ ...marker, base: target }, null, 2)}\n`)
  git(['add', MARKER])
  const rollback = `rollback: git switch ${original} && git branch -D ${branch}`
  if (conflicted) {
    console.log(`\nconflicts (resolve, then \`git add\` and \`git commit\`):\n${git(['diff', '--name-only', '--diff-filter=U'])}${rollback} (discard with: git reset --hard first)`)
    process.exitCode = 2
    return
  }
  git(['commit', '--quiet', '-m', `chore(yishan): upgrade upstream source to ${target.slice(0, 12)}`, '-m', `base ${marker.base}\ntarget ${target}`])
  console.log(`\nupgraded on branch ${branch} in one commit; run your lint/test/build, then merge.\n${rollback}`)
}

function main() {
  const [cmd = 'status', ...rest] = process.argv.slice(2)
  const toIdx = rest.indexOf('--to')
  const to = toIdx >= 0 ? rest[toIdx + 1] : 'main'
  const marker = loadMarker()
  const target = fetchTarget(marker, to)
  if (cmd === 'status') return status(marker, target)
  if (cmd === 'diff') {
    for (const src of Object.keys(marker.pathMap)) process.stdout.write(patchFor(marker, target, src))
    return
  }
  if (cmd === 'apply') return apply(marker, target)
  throw new Error(`unknown command: ${cmd}`)
}

try {
  main()
} catch (err) {
  console.error(`[yishan-upstream] ${err.message}`)
  process.exitCode = 1
}
