import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import sensible from '@fastify/sensible'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'

export { errorHandlerPlugin } from './error-handler'
export type { ErrorHandlerOptions } from './error-handler'

export const cookiePlugin = fp(async fastify => { await fastify.register(cookie) }, { name: 'cookie' })
export const sensiblePlugin = fp(async fastify => { await fastify.register(sensible) }, { name: 'sensible' })
export const typeboxPlugin = fp(async fastify => { fastify.withTypeProvider<TypeBoxTypeProvider>() }, { name: 'typebox-provider' })
export const multipartPlugin = fp(async fastify => {
  await fastify.register(multipart, {
    limits: { fieldNameSize: 100, fieldSize: 1024 * 1024, fields: 20, fileSize: 50 * 1024 * 1024, files: 20, headerPairs: 2000 },
    attachFieldsToBody: false,
    throwFileSizeLimit: true,
  })
}, { name: 'multipart' })
export const swaggerPlugin = fp(async fastify => {
  await fastify.register(swagger, {
    openapi: {
      info: { title: 'Yishan API', description: 'The official Yishan API', version: '2.0.0' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    },
    refResolver: { buildLocalReference: (schema, _base, _fragment, index) => String(schema.$id ?? `def-${index}`) },
  })
  await fastify.register(swaggerUi, { routePrefix: '/api/docs' })
}, { name: 'swagger' })
