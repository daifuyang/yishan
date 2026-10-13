import Fastify from 'fastify'
import usersPlugin from '../src/core/routes/api/v1/app/users/index.ts'
import registerLoginLogSchemas from '../src/core/schemas/login-log.ts'
import registerUserSchemas from '../src/core/schemas/user.ts'
import registerCommonSchemas from '../src/core/schemas/common.ts'
import { errorHandlerPlugin, swaggerPlugin } from '@yishan/core-api/plugins'
import { describe, it, expect } from './runtime-fixture'

const DETAIL_PATH = '/api/v1/app/users/me/login-logs/{id}'
const LIST_PATH = '/api/v1/app/users/me/login-logs'

async function buildSpec() {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async () => undefined)
  app.decorate('requirePermission', () => async () => undefined)

  await app.register(errorHandlerPlugin)
  await app.register(swaggerPlugin)
  registerCommonSchemas(app)
  registerUserSchemas(app)
  registerLoginLogSchemas(app)
  await app.register(usersPlugin, { prefix: '/api/v1/app/users' })
  await app.ready()
  const spec = app.swagger() as any
  await app.close()
  return spec
}

describe('OpenAPI contract for GET /api/v1/app/users/me/login-logs/{id}', () => {
  it('exposes the detail operation the App client calls, reusing the shared detail response', async () => {
    const spec = await buildSpec()

    const detail = spec.paths[DETAIL_PATH]
    expect(detail).toBeDefined()
    expect(spec.paths[LIST_PATH]).toBeDefined()

    // operationId must match the route declaration so the App wrapper targets the right operation.
    expect(detail.get.operationId).toBe('appGetMyLoginLog')
    expect(detail.get.tags).toEqual(['app-users'])
    expect(detail.get.security).toEqual([{ bearerAuth: [] }])
    // Reuses the list endpoint's existing permission; the detail route adds no new code.
    expect(detail.get['x-permission-code']).toBe('app:user:my-logins')

    // Path param is a positive integer, declared once and required.
    const idParam = detail.get.parameters.find((p: any) => p.name === 'id')
    expect(idParam).toBeDefined()
    expect(idParam.in).toBe('path')
    expect(idParam.required).toBe(true)
    expect(idParam.schema.type).toBe('integer')
    expect(idParam.schema.minimum).toBe(1)

    // Response reference is the pre-existing shared detail schema, not a new one.
    expect(detail.get.responses['200'].content['application/json'].schema.$ref)
      .toBe('#/components/schemas/sysLoginLogDetailResp')
    expect(spec.components.schemas.sysLoginLogDetailResp).toBeDefined()
  })
})
