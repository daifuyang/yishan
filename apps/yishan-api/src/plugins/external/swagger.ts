import fp from 'fastify-plugin'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifySwagger from '@fastify/swagger'

export default fp(async function (fastify) {
  /**
   * A Fastify plugin for serving Swagger (OpenAPI v2) or OpenAPI v3 schemas
   *
   * @see {@link https://github.com/fastify/fastify-swagger}
   */
  await fastify.register(fastifySwagger, {
    hideUntagged: true,
    openapi: {
      info: {
        title: 'Yishan API',
        description: 'The official Yishan API',
        version: '0.0.0'
      },
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'sysUsers', description: 'System user management' },
        { name: 'sysRoles', description: 'System role management' },
        { name: 'sysDepts', description: 'System department management' },
        { name: 'sysPosts', description: 'System post management' },
        { name: 'system', description: 'System endpoints' },
        { name: 'attachments', description: 'System attachments' },
        { name: 'storage', description: 'Storage endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    },
    refResolver: {
      buildLocalReference: (json: any, baseUri: any, fragment: string, i: number): string => {
        return json.$id || `def-${i}`
      }
    }
  })

  /**
   * A Fastify plugin for serving Swagger UI.
   *
   * @see {@link https://github.com/fastify/fastify-swagger-ui}
   */
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/api/docs'
  })
})