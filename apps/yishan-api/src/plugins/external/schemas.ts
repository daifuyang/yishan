import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import {
  sysUserSchema,
  sysUserTokenResponseSchema,
  sysUserLoginRequestSchema,
  sysUserRefreshTokenRequestSchema,
  baseResponseSchema,
  errorResponseSchema,
  successResponseSchema,
  unauthorizedResponseSchema,
  notFoundResponseSchema,
  conflictResponseSchema,
  forbiddenResponseSchema
} from '../../schemas/auth.schema.js'
import { sysUserCreateRequestSchema, sysUserQueryRequestSchema, sysUserListResponseSchema, sysUserSearchRequestSchema, sysUserIdParamSchema, sysUserUpdateRequestSchema, sysUserStatusRequestSchema, sysUserStatusResponseSchema, sysRoleUserQueryRequestSchema, sysRoleUserListResponseSchema, sysUserPasswordChangeRequestSchema } from '../../schemas/user.schema.js'
import {
  sysRoleSchema,
  sysRoleCreateRequestSchema,
  sysRoleQueryRequestSchema,
  sysRoleListResponseSchema,
  idParamSchema,
  sysRoleAssignRequestSchema,
  sysRoleUpdateRequestSchema,
  sysRoleStatusUpdateRequestSchema,
  sysRoleBatchDeleteRequestSchema
} from '../../schemas/role.schema.js'
import {
  sysDepartmentSchema,
  sysDepartmentCreateRequestSchema,
  sysDepartmentQueryRequestSchema,
  sysDepartmentListResponseSchema,
  sysDepartmentUpdateRequestSchema,
  sysDepartmentStatusUpdateRequestSchema,
  sysDepartmentBatchDeleteRequestSchema,
  sysDepartmentTreeResponseSchema,
  sysDepartmentMoveRequestSchema,
  sysDepartmentIdParamSchema,
  sysDepartmentMemberQueryRequestSchema,
  sysDepartmentMemberListResponseSchema,
  sysDepartmentBatchRequestSchema,
  sysDepartmentBatchResponseSchema
} from '../../schemas/department.schema.js'
import {
  sysPermissionSchema,
  sysPermissionCreateRequestSchema,
  sysPermissionQueryRequestSchema,
  sysPermissionListResponseSchema,
  sysPermissionUpdateRequestSchema,
  sysPermissionTreeResponseSchema,
  sysPermissionBatchDeleteRequestSchema,
  sysRolePermissionRequestSchema
} from '../../schemas/permission.schema.js'

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
  fastify.addSchema(successResponseSchema)
  fastify.addSchema(unauthorizedResponseSchema)
  fastify.addSchema(notFoundResponseSchema)
  fastify.addSchema(conflictResponseSchema)
  fastify.addSchema(forbiddenResponseSchema)
  
  // 用户管理相关schema
  fastify.addSchema(sysUserCreateRequestSchema)
  fastify.addSchema(sysUserQueryRequestSchema)
  fastify.addSchema(sysUserListResponseSchema)
  fastify.addSchema(sysUserSearchRequestSchema)
  fastify.addSchema(sysUserIdParamSchema)
  fastify.addSchema(sysUserUpdateRequestSchema)
  fastify.addSchema(sysUserStatusRequestSchema)
  fastify.addSchema(sysUserStatusResponseSchema)
  fastify.addSchema(sysRoleUserQueryRequestSchema)
  fastify.addSchema(sysRoleUserListResponseSchema)
  fastify.addSchema(sysUserPasswordChangeRequestSchema)
  
  // 角色管理相关schema
  fastify.addSchema(sysRoleSchema)
  fastify.addSchema(sysRoleCreateRequestSchema)
  fastify.addSchema(sysRoleQueryRequestSchema)
  fastify.addSchema(sysRoleListResponseSchema)
  fastify.addSchema(idParamSchema)
  fastify.addSchema(sysRoleAssignRequestSchema)
  fastify.addSchema(sysRoleUpdateRequestSchema)
  fastify.addSchema(sysRoleStatusUpdateRequestSchema)
  fastify.addSchema(sysRoleBatchDeleteRequestSchema)

  // 部门管理相关schema
  fastify.addSchema(sysDepartmentSchema)
  fastify.addSchema(sysDepartmentCreateRequestSchema)
  fastify.addSchema(sysDepartmentQueryRequestSchema)
  fastify.addSchema(sysDepartmentListResponseSchema)
  fastify.addSchema(sysDepartmentUpdateRequestSchema)
  fastify.addSchema(sysDepartmentStatusUpdateRequestSchema)
  fastify.addSchema(sysDepartmentBatchDeleteRequestSchema)
  fastify.addSchema(sysDepartmentTreeResponseSchema)
  fastify.addSchema(sysDepartmentMoveRequestSchema)
  fastify.addSchema(sysDepartmentIdParamSchema)
  fastify.addSchema(sysDepartmentMemberQueryRequestSchema)
  fastify.addSchema(sysDepartmentMemberListResponseSchema)
  fastify.addSchema(sysDepartmentBatchRequestSchema)
  fastify.addSchema(sysDepartmentBatchResponseSchema)

  // 权限管理相关schema
  fastify.addSchema(sysPermissionSchema)
  fastify.addSchema(sysPermissionCreateRequestSchema)
  fastify.addSchema(sysPermissionQueryRequestSchema)
  fastify.addSchema(sysPermissionListResponseSchema)
  fastify.addSchema(sysPermissionUpdateRequestSchema)
  fastify.addSchema(sysPermissionTreeResponseSchema)
  fastify.addSchema(sysPermissionBatchDeleteRequestSchema)
  fastify.addSchema(sysRolePermissionRequestSchema)

  fastify.log.info('✅ 所有全局schema已注册完成')
}

// 使用fastify-plugin包装插件，自动处理元数据
export default fp(schemasPlugin, {
  name: 'schemas',
  fastify: '5.x'
})