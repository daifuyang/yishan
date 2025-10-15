import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import {
  sysUserSchema,
  sysUserTokenResponseSchema,
  sysUserLoginRequestSchema,
  sysUserRefreshTokenRequestSchema,
  baseResponseSchema,
  errorResponseSchema,
  unauthorizedResponseSchema
} from '../../schemas/auth.schema.js'
import {
  sysUserCreateRequestSchema,
  sysUserQueryRequestSchema,
  sysUserListResponseSchema,
  sysUserSearchRequestSchema,
  sysUserIdParamSchema,
  sysUserUpdateRequestSchema,
  sysUserStatusRequestSchema,
  sysUserStatusResponseSchema
} from '../../schemas/user.schema.js'
import {
  sysRoleSchema,
  sysRoleCreateRequestSchema,
  sysRoleQueryRequestSchema,
  sysRoleListResponseSchema,
  idParamSchema,
  sysRoleAssignRequestSchema
} from '../../schemas/role.schema.js'

/**
 * 全局Schema注册插件
 * 集中管理所有JSON Schema，确保全局唯一性
 */
async function schemasPlugin(fastify: FastifyInstance) {
  // 认证相关schema
  fastify.addSchema(sysUserSchema)
  fastify.addSchema(sysUserTokenResponseSchema)
  fastify.addSchema(sysUserLoginRequestSchema)
  fastify.addSchema(sysUserRefreshTokenRequestSchema)
  fastify.addSchema(baseResponseSchema)
  fastify.addSchema(errorResponseSchema)
  fastify.addSchema(unauthorizedResponseSchema)
  
  // 用户管理相关schema
  fastify.addSchema(sysUserCreateRequestSchema)
  fastify.addSchema(sysUserQueryRequestSchema)
  fastify.addSchema(sysUserListResponseSchema)
  fastify.addSchema(sysUserSearchRequestSchema)
  fastify.addSchema(sysUserIdParamSchema)
  fastify.addSchema(sysUserUpdateRequestSchema)
  fastify.addSchema(sysUserStatusRequestSchema)
  fastify.addSchema(sysUserStatusResponseSchema)
  
  // 角色管理相关schema
  fastify.addSchema(sysRoleSchema)
  fastify.addSchema(sysRoleCreateRequestSchema)
  fastify.addSchema(sysRoleQueryRequestSchema)
  fastify.addSchema(sysRoleListResponseSchema)
  fastify.addSchema(idParamSchema)
  fastify.addSchema(sysRoleAssignRequestSchema)

  fastify.log.info('✅ 所有全局schema已注册完成')
}

// 使用fastify-plugin包装插件，自动处理元数据
export default fp(schemasPlugin, {
  name: 'schemas',
  fastify: '5.x'
})