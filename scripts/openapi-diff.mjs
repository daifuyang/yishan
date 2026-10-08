#!/usr/bin/env node
/**
 * openapi-diff.mjs — 分类比较两份 OpenAPI 3 文档，任何未经逐项批准的差异都以退出码 1 结束。
 *
 * 用法：
 *   node scripts/openapi-diff.mjs <expected.json> <actual.json> [--allow <allow.json>] [--json] [--prefix api/v1]
 *
 * 差异类别（按 方法+路径 比较；Schema 先展开 $ref 再取指纹，组件 Schema 的变化也会被发现）：
 *   path-added / path-removed         路径整体增删
 *   method-added / method-removed     已有路径上的 HTTP 方法增删
 *   request-changed                   parameters / requestBody 变化
 *   response-changed                  响应状态码集合或任一响应 Schema 变化
 *   security-changed                  操作级 security（未声明 = 继承全局）变化
 *   operation-id-changed              operationId 变化（会改变生成客户端的函数名）
 *   metadata-changed                  tags / summary / description 变化
 *   global-security-changed           文档级 security 变化
 *   duplicate-operation-id            actual 中出现 expected 没有的重复 operationId（OpenAPI 要求唯一）
 *
 * --allow 文件：{ "allowed": [ { "key": "<类别>|<METHOD path>", "reason": "..." } ] }
 *   只豁免精确匹配的单项差异；未使用的豁免项也会导致失败，避免过期批准长期存在。
 * Windows Git Bash 会改写以 / 开头的参数，--prefix 可写成 api/v1。
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace']

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
  return v
}

/** 展开本地 $ref（#/components/...），循环引用以 {$cycle: ref} 截断。 */
export function deref(value, spec, seen = new Set()) {
  if (Array.isArray(value)) return value.map((x) => deref(x, spec, seen))
  if (!value || typeof value !== 'object') return value
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) {
    if (seen.has(value.$ref)) return { $cycle: value.$ref }
    const target = value.$ref.slice(2).split('/').reduce((o, k) => o?.[k.replace(/~1/g, '/').replace(/~0/g, '~')], spec)
    return deref(target, spec, new Set([...seen, value.$ref]))
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deref(v, spec, seen)]))
}

const fp = (v) => (v === undefined ? '-' : createHash('sha256').update(JSON.stringify(sortKeys(v))).digest('hex').slice(0, 12))

export function operations(spec, rawPrefix) {
  const prefix = rawPrefix && !rawPrefix.startsWith('/') ? `/${rawPrefix}` : rawPrefix
  const ops = new Map()
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    if (prefix && !path.startsWith(prefix)) continue
    for (const m of METHODS) {
      const op = item?.[m]
      if (!op) continue
      const params = deref([...(item.parameters ?? []), ...(op.parameters ?? [])], spec)
      const responses = deref(op.responses ?? {}, spec)
      ops.set(`${m.toUpperCase()} ${path}`, {
        path,
        request: fp({ params, body: deref(op.requestBody, spec) }),
        responseCodes: Object.keys(responses).sort().join(','),
        responses: Object.fromEntries(Object.keys(responses).sort().map((c) => [c, fp(responses[c])])),
        security: op.security === undefined ? 'inherit' : op.security.length === 0 ? 'public' : op.security.map((s) => Object.keys(s).sort().join('+')).sort().join('|'),
        operationId: op.operationId ?? '-',
        metadata: fp({ tags: op.tags ?? [], summary: op.summary, description: op.description }),
      })
    }
  }
  return ops
}

export function duplicateOperationIds(spec) {
  const seen = new Map()
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const m of METHODS) {
      const id = item?.[m]?.operationId
      if (id) seen.set(id, [...(seen.get(id) ?? []), `${m.toUpperCase()} ${path}`])
    }
  }
  return new Map([...seen].filter(([, ops]) => ops.length > 1))
}

export function diffSpecs(expected, actual, prefix) {
  const changes = []
  const add = (category, key, detail) => changes.push({ category, key: `${category}|${key}`, detail })
  if (fp(expected.security) !== fp(actual.security)) add('global-security-changed', '(document)', `${JSON.stringify(expected.security)} -> ${JSON.stringify(actual.security)}`)
  const E = operations(expected, prefix)
  const A = operations(actual, prefix)
  const ePaths = new Set([...E.values()].map((o) => o.path))
  const aPaths = new Set([...A.values()].map((o) => o.path))
  for (const [k, e] of E) {
    const a = A.get(k)
    if (!a) {
      if (aPaths.has(e.path)) add('method-removed', k, '')
      else add('path-removed', k, '')
      continue
    }
    if (e.request !== a.request) add('request-changed', k, `${e.request} -> ${a.request}`)
    if (e.responseCodes !== a.responseCodes || Object.keys(e.responses).some((c) => e.responses[c] !== a.responses[c])) {
      const codes = [...new Set([...Object.keys(e.responses), ...Object.keys(a.responses)])].sort()
      add('response-changed', k, codes.filter((c) => e.responses[c] !== a.responses[c]).map((c) => `${c}: ${e.responses[c] ?? 'absent'} -> ${a.responses[c] ?? 'absent'}`).join('; '))
    }
    if (e.security !== a.security) add('security-changed', k, `${e.security} -> ${a.security}`)
    if (e.operationId !== a.operationId) add('operation-id-changed', k, `${e.operationId} -> ${a.operationId}`)
    if (e.metadata !== a.metadata) add('metadata-changed', k, `${e.metadata} -> ${a.metadata}`)
  }
  for (const [k, a] of A) {
    if (E.has(k)) continue
    add(ePaths.has(a.path) ? 'method-added' : 'path-added', k, '')
  }
  const knownDup = duplicateOperationIds(expected)
  for (const [id, ops] of duplicateOperationIds(actual)) {
    if (!knownDup.has(id) || knownDup.get(id).join() !== ops.join()) add('duplicate-operation-id', id, ops.join(' & '))
  }
  changes.sort((x, y) => x.key.localeCompare(y.key))
  return { changes, expectedOps: E.size, actualOps: A.size }
}

function main() {
  const args = process.argv.slice(2)
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const positional = args.filter((a, i) => !a.startsWith('--') && !['--allow', '--prefix'].includes(args[i - 1]))
  const [expectedPath, actualPath] = positional
  if (!expectedPath || !actualPath) {
    console.error('usage: openapi-diff.mjs <expected.json> <actual.json> [--allow allow.json] [--json] [--prefix api/v1]')
    process.exit(2)
  }
  const load = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const { changes, expectedOps, actualOps } = diffSpecs(load(expectedPath), load(actualPath), opt('--prefix'))
  const allowFile = opt('--allow')
  const allowed = allowFile ? load(allowFile).allowed ?? [] : []
  const allowedKeys = new Map(allowed.map((a) => [a.key, a.reason]))
  const unapproved = changes.filter((c) => !allowedKeys.has(c.key))
  const approved = changes.filter((c) => allowedKeys.has(c.key))
  const unused = allowed.filter((a) => !changes.some((c) => c.key === a.key))

  if (args.includes('--json')) {
    console.log(JSON.stringify({ expected: expectedPath, actual: actualPath, expectedOps, actualOps, changes, approved: approved.map((c) => c.key), unused: unused.map((a) => a.key) }, null, 2))
  } else {
    console.log(`[openapi-diff] ${expectedPath} (${expectedOps} ops) vs ${actualPath} (${actualOps} ops)`)
    const byCat = new Map()
    for (const c of changes) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c])
    for (const [cat, list] of [...byCat].sort()) {
      console.log(`  ${cat} (${list.length})`)
      for (const c of list) console.log(`    ${allowedKeys.has(c.key) ? '[allowed] ' : ''}${c.key.slice(cat.length + 1)}${c.detail ? `  ${c.detail}` : ''}`)
    }
    for (const a of unused) console.log(`  unused allow entry: ${a.key}`)
    console.log(`[openapi-diff] ${changes.length} change(s), ${approved.length} allowed, ${unapproved.length} unapproved, ${unused.length} unused allow entr${unused.length === 1 ? 'y' : 'ies'}`)
  }
  process.exit(unapproved.length || unused.length ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
