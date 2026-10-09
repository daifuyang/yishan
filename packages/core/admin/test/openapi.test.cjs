const { test } = require('node:test')
const assert = require('node:assert/strict')
const { selectOpenApi } = require('../build/openapi.cjs')

test('inline schemas retain the schemas container required by the official client generator', () => {
  const document = { openapi: '3.0.3', paths: {
    '/api/v1/auth/me': { get: { responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'number' } } } } } } } } },
    '/api/catalog/items': { get: {} },
  } }
  const selected = selectOpenApi(document, path => path.startsWith('/api/v1/'))
  assert.deepEqual(Object.keys(selected.paths), ['/api/v1/auth/me'])
  assert.deepEqual(selected.components.schemas, {})
  assert.equal(selected.paths['/api/v1/auth/me'].get.responses[200].content['application/json'].schema.properties.id.type, 'number')
  assert.equal(document.components, undefined)
})

test('partition retains transitive schemas and authentication while excluding other module models', () => {
  const document = { paths: {
    '/api/catalog/items': { get: { responses: { 200: { $ref: '#/components/responses/Items' } } } },
    '/api/absent/items': { get: { schema: { $ref: '#/components/schemas/Absent' } } },
  }, security: [{ bearer: [] }], components: {
    responses: { Items: { schema: { $ref: '#/components/schemas/Item' } } },
    schemas: { Item: { properties: { related: { $ref: '#/components/schemas/Related' } } }, Related: { type: 'string' }, Absent: { type: 'number' } },
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
  } }
  const selected = selectOpenApi(document, path => path.startsWith('/api/catalog/'))
  assert.deepEqual(Object.keys(selected.components.schemas), ['Item', 'Related'])
  assert.deepEqual(selected.components.securitySchemes, document.components.securitySchemes)
  assert.deepEqual(selected.security, document.security)
  assert.throws(() => selectOpenApi({ paths: { '/broken': { $ref: '#/components/schemas/Missing' } } }, () => true), /Unresolved OpenAPI reference/)
})

test('operation-level security retains its scheme when the API has no root security declaration', () => {
  const document = { paths: {
    '/api/v1/auth/me': { get: { security: [{ bearerAuth: [] }] } },
    '/api/absent/secret': { get: { security: [{ unrelated: [] }] } },
  }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' }, unrelated: { type: 'apiKey', in: 'header', name: 'x-key' } } } }
  const selected = selectOpenApi(document, path => path.startsWith('/api/v1/'))
  assert.deepEqual(selected.components.securitySchemes, { bearerAuth: document.components.securitySchemes.bearerAuth })
  assert.deepEqual(selected.paths['/api/v1/auth/me'].get.security, [{ bearerAuth: [] }])
})
