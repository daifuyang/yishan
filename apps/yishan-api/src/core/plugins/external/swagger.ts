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
       security: [{ bearerAuth: [] }],
       tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'sysUsers', description: 'System user management' },
        { name: 'sysRoles', description: 'System role management' },
        { name: 'sysDepts', description: 'System department management' },
        { name: 'sysPosts', description: 'System post management' },
        { name: 'sysApps', description: 'System app management' },
        { name: 'sysAppResources', description: 'System app resource management' },
        { name: 'sysAppMenus', description: 'System app menu management' },
        { name: 'sysForms', description: 'System form management' },
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
    // 业务模块的 tag 不在这里硬编码：已挂载模块各自贡献一个 `{ name: id, description }`
    // （来自模块 meta），在首次生成文档时追加到全局 tags 末尾。
    transformObject: ({ openapiObject }: any) => {
      const moduleTags = fastify.moduleLoader?.listOpenapiTags() ?? []
      if (moduleTags.length === 0) return openapiObject
      const known = new Set((openapiObject.tags ?? []).map((t: { name: string }) => t.name))
      return {
        ...openapiObject,
        tags: [...(openapiObject.tags ?? []), ...moduleTags.filter((t) => !known.has(t.name))],
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
