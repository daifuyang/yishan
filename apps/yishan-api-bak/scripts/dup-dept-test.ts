import Fastify from 'fastify'
import serviceApp from '../src/app.js'

async function run() {
  const app = Fastify({ logger: false })
  await app.register(serviceApp)
  await app.ready()

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/login',
    payload: {
      username: 'admin',
      password: 'admin123'
    }
  })
  const loginData = JSON.parse(loginResponse.body)
  const accessToken = loginData?.data?.accessToken
  console.log('login status:', loginResponse.statusCode)

  const payload = {
    deptName: 'duplicate_dept',
    parentId: null,
    deptType: 2,
    status: 1,
    sortOrder: 1
  }

  const first = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/departments',
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    payload
  })
  console.log('first status:', first.statusCode)
  console.log('first body:', first.body)

  const second = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/departments',
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    payload
  })
  console.log('second status:', second.statusCode)
  console.log('second body:', second.body)

  await app.close()
}

run().catch(err => {
  console.error('script error:', err)
  process.exit(1)
})