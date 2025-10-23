import fp from 'fastify-plugin'
import { 
  UserBaseSchema, 
  UserListQuerySchema, 
  UserCreateSchema, 
  UserUpdateSchema,
  PaginationSchema,
  UserListResponseSchema,
  UserDetailResponseSchema,
  SuccessResponseSchema
} from '../../schemas/user.js'

export interface SchemasPluginOptions {
  // Schema plugin options
}

// Schema插件，定义共享的Schema引用
export default fp<SchemasPluginOptions>(async (fastify, opts) => {
  // 错误响应Schema
  fastify.addSchema({
    $id: 'errorResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      code: { type: 'number', example: 50000 },
      message: { type: 'string', example: '系统错误' },
      data: { type: 'null' },
      error: {
        type: 'object',
        properties: {
          details: { type: 'string' },
          stack: { type: 'string' },
          validation: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      },
      timestamp: { type: 'string', format: 'date-time' }
    }
  })

  // 未授权响应Schema
  fastify.addSchema({
    $id: 'unauthorizedResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      code: { type: 'number', example: 40100 },
      message: { type: 'string', example: '未授权访问' },
      data: { type: 'null' },
      timestamp: { type: 'string', format: 'date-time' }
    }
  })

  // 禁止访问响应Schema
  fastify.addSchema({
    $id: 'forbiddenResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      code: { type: 'number', example: 40300 },
      message: { type: 'string', example: '禁止访问' },
      data: { type: 'null' },
      timestamp: { type: 'string', format: 'date-time' }
    }
  })

  // 资源未找到响应Schema
  fastify.addSchema({
    $id: 'notFoundResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      code: { type: 'number', example: 40400 },
      message: { type: 'string', example: '资源未找到' },
      data: { type: 'null' },
      timestamp: { type: 'string', format: 'date-time' }
    }
  })

  // 验证错误响应Schema
  fastify.addSchema({
    $id: 'validationErrorResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      code: { type: 'number', example: 40000 },
      message: { type: 'string', example: '请求参数验证失败' },
      data: { type: 'null' },
      error: {
        type: 'object',
        properties: {
          validation: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      },
      timestamp: { type: 'string', format: 'date-time' }
    }
  })

  // 分页响应Schema
  fastify.addSchema({
    $id: 'paginatedResponse',
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      code: { type: 'number', example: 10000 },
      message: { type: 'string', example: '获取成功' },
      data: {
        type: 'array',
        items: { type: 'object' }
      },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'number', description: '当前页码' },
          pageSize: { type: 'number', description: '每页数量' },
          total: { type: 'number', description: '总记录数' },
          totalPages: { type: 'number', description: '总页数' }
        }
      },
      timestamp: { type: 'string', format: 'date-time' }
    }
  })

  // 注册用户相关的 TypeBox Schema（直接使用 TypeBox Schema 对象）
  fastify.addSchema(UserBaseSchema)
  fastify.addSchema(UserListQuerySchema)
  fastify.addSchema(UserCreateSchema)
  fastify.addSchema(UserUpdateSchema)
  fastify.addSchema(PaginationSchema)
  fastify.addSchema(UserListResponseSchema)
  fastify.addSchema(UserDetailResponseSchema)
  fastify.addSchema(SuccessResponseSchema)
})