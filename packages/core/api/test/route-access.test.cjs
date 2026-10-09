const { test } = require('node:test')
const assert = require('node:assert/strict')
const Fastify = require('fastify')
const { createRouteRegistrar } = require('../dist/routes/route-registrar')

const permission = { code: 'sample:read', label: 'Read', group: 'sample' }

test('protected registration fails closed when authentication is missing', () => {
  const app = Fastify()
  assert.throws(() => createRouteRegistrar(app).get('/secret', { access: { permission } }, () => 'secret'), /authentication|authenticate/)
})

test('public declaration clears security and protected declaration has bearer security', async () => {
  const app = Fastify()
  app.decorate('authenticate', async (_request, reply) => { reply.code(401).send({ code: 10001 }) })
  app.decorate('requirePermission', () => async () => {})
  const route = createRouteRegistrar(app)
  const schemas = []
  app.addHook('onRoute', options => schemas.push(options.schema))
  route.get('/public', { access: { permission, public: true } }, () => 'public')
  route.get('/secret', { access: { permission } }, () => 'secret')
  assert.equal((await app.inject('/public')).statusCode, 200)
  assert.equal((await app.inject('/secret')).statusCode, 401)
  assert.deepEqual(schemas[0].security, [])
  assert.deepEqual(schemas.find(schema => schema.security?.length).security, [{ bearerAuth: [] }])
  await app.close()
})
