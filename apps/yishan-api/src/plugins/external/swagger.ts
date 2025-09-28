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
        { name: 'sysAuth', description: '系统用户认证' },
        { name: 'sysUsers', description: '系统用户接口' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        schemas: {
          PaginationResponse: {
            type: 'object',
            properties: {
              page: { type: 'number', description: '当前页码' },
              pageSize: { type: 'number', description: '每页条数' },
              total: { type: 'number', description: '总记录数' },
              totalPages: { type: 'number', description: '总页数' }
            },
            required: ['page', 'pageSize', 'total', 'totalPages']
          },
          StandardResponse: {
            type: 'object',
            properties: {
              code: { 
                type: 'number', 
                description: '业务状态码（5位数字：20000-29999成功，40000-49999客户端错误，50000-59999服务器错误）',
                example: 20000
              },
              message: { type: 'string', description: '响应消息' }
            },
            required: ['code', 'message']
          },
          PaginatedResponse: {
            allOf: [
              { $ref: '#/components/schemas/StandardResponse' },
              {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      list: {
                        type: 'array',
                        description: '数据列表',
                        items: {
                          type: 'object'
                        }
                      },
                      pagination: {
                        $ref: '#/components/schemas/PaginationResponse'
                      }
                    },
                    required: ['list', 'pagination']
                  }
                },
                required: ['data']
              }
            ]
          }
        }
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