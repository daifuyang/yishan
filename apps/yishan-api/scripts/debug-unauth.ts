import Fastify from 'fastify'
import serviceApp from '../src/app.js'

async function run() {
  const app = Fastify({ logger: false })
  await app.register(serviceApp)

  const res = await app.inject({ method: 'POST', url: '/api/v1/logout' })
  console.log('status=', res.statusCode)
  console.log('body=', res.body)
  try {
    console.log('json=', JSON.parse(res.body))
  } catch (e) {
    console.log('parse error', e)
  }

  await app.close()
}

run().catch(err => {
  console.error('err', err)
})