import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { diffSpecs } from './openapi-diff.mjs'

const ok = (schema) => ({ 200: { description: 'ok', content: { 'application/json': { schema } } } })
const base = () => ({
  openapi: '3.0.0',
  security: [{ bearerAuth: [] }],
  components: { schemas: { User: { type: 'object', properties: { id: { type: 'integer' } } } } },
  paths: {
    '/a': { get: { operationId: 'getA', tags: ['t'], responses: ok({ $ref: '#/components/schemas/User' }) } },
    '/b': { get: { operationId: 'getB', responses: ok({ type: 'string' }) }, post: { operationId: 'postB', security: [], responses: ok({ type: 'string' }) } },
  },
})

const keys = (e, a) => diffSpecs(e, a).changes.map((c) => c.key)

test('identical specs produce no changes', () => {
  assert.deepEqual(keys(base(), base()), [])
})

test('classifies each kind of change', () => {
  const a = base()
  a.components.schemas.User.properties.name = { type: 'string' } // via $ref → response-changed
  a.paths['/a'].get.tags = ['other'] // metadata
  a.paths['/a'].get.operationId = 'fetchA'
  a.paths['/b'].post.security = [{ bearerAuth: [] }]
  delete a.paths['/b'].get // method removed (path still exists)
  a.paths['/b'].put = { operationId: 'putB', parameters: [{ name: 'q', in: 'query' }], responses: ok({ type: 'string' }) }
  a.paths['/c'] = { get: { operationId: 'getC', responses: ok({ type: 'string' }) } }
  assert.deepEqual(keys(base(), a), [
    'metadata-changed|GET /a',
    'method-added|PUT /b',
    'method-removed|GET /b',
    'operation-id-changed|GET /a',
    'path-added|GET /c',
    'response-changed|GET /a',
    'security-changed|POST /b',
  ])
})

test('request and global security changes; path removal', () => {
  const a = base()
  a.security = []
  a.paths['/a'].get.parameters = [{ name: 'id', in: 'query', required: true }]
  delete a.paths['/b']
  assert.deepEqual(keys(base(), a), ['global-security-changed|(document)', 'path-removed|GET /b', 'path-removed|POST /b', 'request-changed|GET /a'])
})

test('reports only newly introduced duplicate operationIds', () => {
  const e = base()
  e.paths['/b'].get.operationId = 'getA' // pre-existing duplicate
  const a = structuredClone(e)
  assert.deepEqual(keys(e, a), [])
  a.paths['/b'].post.operationId = 'getA'
  assert.ok(keys(e, a).includes('duplicate-operation-id|getA'))
})

test('CLI exits 1 on unapproved changes, 0 when each is explicitly allowed, 1 for unused allow entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openapi-diff-'))
  try {
    const cli = fileURLToPath(new URL('./openapi-diff.mjs', import.meta.url))
    const a = base()
    a.paths['/c'] = { get: { operationId: 'getC', responses: ok({ type: 'string' }) } }
    writeFileSync(join(dir, 'e.json'), JSON.stringify(base()))
    writeFileSync(join(dir, 'a.json'), JSON.stringify(a))
    const run = (...extra) => spawnSync(process.execPath, [cli, join(dir, 'e.json'), join(dir, 'a.json'), ...extra], { encoding: 'utf8' }).status
    assert.equal(run(), 1)
    writeFileSync(join(dir, 'allow.json'), JSON.stringify({ allowed: [{ key: 'path-added|GET /c', reason: 'test' }] }))
    assert.equal(run('--allow', join(dir, 'allow.json')), 0)
    writeFileSync(join(dir, 'allow2.json'), JSON.stringify({ allowed: [{ key: 'path-added|GET /c', reason: 'test' }, { key: 'path-added|GET /zzz', reason: 'stale' }] }))
    assert.equal(run('--allow', join(dir, 'allow2.json')), 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
