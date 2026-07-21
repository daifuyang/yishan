import Fastify from 'fastify'
import AutoLoad from '@fastify/autoload'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import registerSchemas from '../core/schemas/index.js'
import swaggerPlugin from '../core/plugins/external/swagger.js'

const noOpGuard = async () => undefined

async function buildOpenApiDocument(): Promise<Record<string, unknown>> {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', noOpGuard)
  app.decorate('requirePermission', () => noOpGuard as never)
  app.decorate('requireRole', () => noOpGuard as never)
  app.decorate('rateLimit', () => noOpGuard as never)

  await app.register(swaggerPlugin)
  await app.register(registerSchemas)
  await app.register(AutoLoad, {
    dir: join(__dirname, '../core/routes'),
    autoHooks: true,
    cascadeHooks: true,
  })

  await app.ready()
  const document = app.swagger() as Record<string, unknown>
  await app.close()
  return document
}

async function main(): Promise<void> {
  const document = await buildOpenApiDocument()
  const outputPath = join(__dirname, '../../openapi.json')
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`)
  console.log(`OpenAPI exported to ${outputPath}`)
}

void main()