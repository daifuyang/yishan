#!/usr/bin/env node
// Compare P0 baseline artifacts.
//   node p0-compare.mjs smoke   <expected.json> <actual.json>
//   node p0-compare.mjs openapi <expected.json> <actual.json> [--prefix /api/v1]
//   node p0-compare.mjs contract <openapi.json>            (print operation table as TSV)
// Exit code 1 when differences are found (smoke/openapi modes).
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const [mode, a, b, ...rest] = process.argv.slice(2)
const load = (p) => JSON.parse(readFileSync(p, 'utf8'))
const METHODS = ['get', 'post', 'put', 'patch', 'delete']

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
  return v
}
const fp = (v) => (v === undefined ? '-' : createHash('sha256').update(JSON.stringify(sortKeys(v))).digest('hex').slice(0, 10))

function operations(spec, rawPrefix) {
  // Accept "api/v1" too: Git Bash on Windows rewrites a leading-slash argument into a filesystem path.
  const prefix = rawPrefix && !rawPrefix.startsWith('/') ? `/${rawPrefix}` : rawPrefix
  const out = new Map()
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    if (prefix && !path.startsWith(prefix)) continue
    for (const m of METHODS) {
      const op = item[m]
      if (!op) continue
      const security = op.security === undefined ? 'inherit' : op.security.length === 0 ? 'public' : op.security.map((s) => Object.keys(s).join('+')).join('|')
      out.set(`${m.toUpperCase()} ${path}`, {
        operationId: op.operationId ?? '-',
        tag: (op.tags ?? [])[0] ?? '-',
        security,
        params: fp(op.parameters),
        body: fp(op.requestBody),
        responses: Object.keys(op.responses ?? {}).sort().join(','),
        respSchema: fp(op.responses),
      })
    }
  }
  return out
}

if (mode === 'contract') {
  const ops = operations(load(a), rest[0])
  console.log(['operation', 'operationId', 'tag', 'security', 'responses', 'paramsFp', 'bodyFp', 'respFp'].join('\t'))
  for (const [k, v] of [...ops].sort()) console.log([k, v.operationId, v.tag, v.security, v.responses, v.params, v.body, v.respSchema].join('\t'))
  process.exit(0)
}

let diffs = 0
if (mode === 'smoke') {
  const key = (r) => `${r.phase === undefined ? '' : ''}${r.id}`
  const idx = (arr) => { const m = new Map(); const seen = {}; for (const r of arr) { const k0 = key(r); seen[k0] = (seen[k0] ?? 0) + 1; m.set(seen[k0] > 1 ? `${k0}#${seen[k0]}` : k0, r) } return m }
  const E = idx(load(a)), A = idx(load(b))
  for (const [k, e] of E) {
    const x = A.get(k)
    if (!x) { console.log(`MISSING  ${k}`); diffs++; continue }
    if (e.status !== x.status || e.code !== x.code || e.envelopeKeys !== x.envelopeKeys) {
      console.log(`CHANGED  ${k}: ${e.status}/${e.code}/{${e.envelopeKeys}} -> ${x.status}/${x.code}/{${x.envelopeKeys}}`); diffs++
    }
  }
  for (const k of A.keys()) if (!E.has(k)) { console.log(`EXTRA    ${k}`); diffs++ }
} else if (mode === 'openapi') {
  const pi = rest.indexOf('--prefix')
  const prefix = pi >= 0 ? rest[pi + 1] : undefined
  const E = operations(load(a), prefix), A = operations(load(b), prefix)
  for (const [k, e] of E) {
    const x = A.get(k)
    if (!x) { console.log(`REMOVED  ${k}`); diffs++; continue }
    const changed = Object.keys(e).filter((f) => e[f] !== x[f])
    if (changed.length) { console.log(`CHANGED  ${k}: ${changed.map((f) => `${f} ${e[f]} -> ${x[f]}`).join('; ')}`); diffs++ }
  }
  for (const k of A.keys()) if (!E.has(k)) { console.log(`ADDED    ${k}`); diffs++ }
  console.log(`operations: expected=${E.size} actual=${A.size} diffs=${diffs}`)
} else {
  console.error('usage: p0-compare.mjs smoke|openapi|contract ...'); process.exit(2)
}
process.exit(diffs ? 1 : 0)
