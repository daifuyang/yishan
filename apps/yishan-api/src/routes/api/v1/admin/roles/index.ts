import { FastifyPluginAsync } from 'fastify'
import { RoleService } from '../../../../../services/roleService.js'
import { ErrorCode } from '../../../../../constants/business-code.js'
import { ResponseUtil } from '../../../../../utils/response.js'

const roleRoutes: FastifyPluginAsync = async function (fastify, opts) {
  const roleService = new RoleService(fastify)

  // 创建角色
  fastify.post('/', {
    schema: {
      operationId: 'createRole',
      summary: '创建角色',
      description: '创建新角色',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      body: { $ref: 'sysRoleCreateRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '角色创建成功' },
            data: { $ref: 'sysRole#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        409: { $ref: 'conflictResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const body = request.body as any
        const creatorId = (request as any).user.id

        const createData = {
          ...body,
          creatorId
        }

        const role = await roleService.createRole(createData)
        
        return ResponseUtil.success(
          reply,
          request,
          role,
          '角色创建成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        if (error instanceof Error) {
          if (error.message.includes('角色名称已存在') || error.message.includes('name')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.ROLE_ALREADY_EXISTS,
              '角色名称已存在'
            )
          }
          if (error.message.includes('角色代码已存在') || error.message.includes('code')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.ROLE_ALREADY_EXISTS,
              '角色代码已存在'
            )
          }
        }
        
        const errorMessage = error instanceof Error ? error.message : '创建失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 获取角色列表
  fastify.get('/', {
    schema: {
      operationId: 'getRoleList',
      summary: '获取角色列表',
      description: '获取角色列表，支持分页和筛选',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      querystring: { $ref: 'sysRoleQueryRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysRoleListResponse#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const query = request.query as any
        const result = await roleService.getRoles(query)
        
        return ResponseUtil.paginated(
          reply,
          request,
          result.roles,
          result.total,
          result.page,
          result.pageSize,
          '获取成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 获取角色详情
  fastify.get('/:id', {
    schema: {
      operationId: 'getRoleById',
      summary: '获取角色详情',
      description: '根据ID获取角色详细信息',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '角色ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysRole#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const role = await roleService.getRoleById(id)
        
        if (!role) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.ROLE_NOT_FOUND,
            '角色不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          role,
          '获取成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 更新角色信息
  fastify.put('/:id', {
    schema: {
      operationId: 'updateRole',
      summary: '更新角色信息',
      description: '更新指定角色的信息',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '角色ID' }
        }
      },
      body: { $ref: 'sysRoleUpdateRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '更新成功' },
            data: { $ref: 'sysRole#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        409: { $ref: 'conflictResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const body = request.body as any
        const updaterId = (request as any).user.id

        const updateData = {
          ...body,
          updaterId
        }

        const role = await roleService.updateRole(id, updateData)
        
        if (!role) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.ROLE_NOT_FOUND,
            '角色不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          role,
          '更新成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        if (error instanceof Error) {
          if (error.message.includes('角色不存在')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.ROLE_NOT_FOUND,
              '角色不存在'
            )
          }
          if (error.message.includes('已存在') || error.message.includes('duplicate')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.ROLE_ALREADY_EXISTS,
              error.message
            )
          }
        }
        
        const errorMessage = error instanceof Error ? error.message : '更新失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 删除角色
  fastify.delete('/:id', {
    schema: {
      operationId: 'deleteRole',
      summary: '删除角色',
      description: '删除指定角色',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '角色ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '删除成功' },
            data: { type: 'null' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const deleterId = (request as any).user.id

        const result = await roleService.deleteRole(id, deleterId)
        
        if (!result) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.ROLE_NOT_FOUND,
            '角色不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          null,
          '删除成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        if (error instanceof Error) {
          if (error.message.includes('角色正在使用中')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.ROLE_IN_USE,
              '角色正在使用中，无法删除'
            )
          }
          if (error.message.includes('角色不存在')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.ROLE_NOT_FOUND,
              '角色不存在'
            )
          }
        }
        
        const errorMessage = error instanceof Error ? error.message : '删除失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 修改角色状态
  fastify.patch('/:id/status', {
    schema: {
      operationId: 'updateRoleStatus',
      summary: '修改角色状态',
      description: '修改指定角色的状态',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '角色ID' }
        }
      },
      body: { $ref: 'sysRoleStatusUpdateRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '状态更新成功' },
            data: { $ref: 'sysRole#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const { status } = request.body as { status: number }
        const updaterId = (request as any).user.id

        const role = await roleService.changeRoleStatus(id, status, updaterId)
        
        if (!role) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.ROLE_NOT_FOUND,
            '角色不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          role,
          '状态更新成功'
        )
      } catch (error) {
        fastify.log.error(error)
        const errorMessage = error instanceof Error ? error.message : '状态更新失败'

        if (error instanceof Error) {
          if (error.message.includes('角色不存在')) {
            return ResponseUtil.error(reply, request, ErrorCode.ROLE_NOT_FOUND, '角色不存在')
          }
          if (error.message.includes('系统角色不允许禁用')) {
              return ResponseUtil.error(reply, request, ErrorCode.INVALID_PARAMETER, '系统角色不允许禁用')
            }
        }

        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 获取角色权限
  fastify.get('/:id/permissions', {
    schema: {
      operationId: 'getRolePermissions',
      summary: '获取角色权限',
      description: '获取指定角色的权限列表',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '角色ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: {
              type: 'array',
              items: { $ref: 'sysPermission#' }
            },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const permissions = await roleService.getRolePermissions(id)
        
        return ResponseUtil.success(
          reply,
          request,
          permissions,
          '获取成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 分配用户角色
  fastify.post('/assign', {
    schema: {
      operationId: 'assignUserRoles',
      summary: '为用户分配角色',
      description: '为指定用户分配一个或多个角色',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      body: { $ref: 'sysRoleAssignRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '角色分配成功' },
            data: { type: 'null' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { userId, roleIds } = request.body as { userId: number; roleIds: number[] }
        const assignedBy = (request as any).user?.id

        await roleService.assignRolesToUser({ userId, roleIds, assignedBy })

        return ResponseUtil.success(
          reply,
          request,
          null,
          '角色分配成功'
        )
      } catch (error) {
        const msg = error instanceof Error ? error.message : '角色分配失败'

        if (error instanceof Error) {
          if (msg.includes('用户不存在')) {
            return ResponseUtil.error(reply, request, ErrorCode.USER_NOT_FOUND, '用户不存在')
          }
          if (msg.includes('角色ID') && msg.includes('不存在')) {
              return ResponseUtil.error(reply, request, ErrorCode.ROLE_NOT_FOUND, '角色不存在')
            }
          if (msg.includes('禁用')) {
            return ResponseUtil.error(reply, request, ErrorCode.INVALID_PARAMETER, '角色已禁用，无法分配')
          }
        }

        return ResponseUtil.error(reply, request, ErrorCode.SYSTEM_ERROR, msg)
      }
    }
  })

  // 获取指定用户的角色列表
  fastify.get('/user/:userId', {
    schema: {
      operationId: 'getUserRoles',
      summary: '获取用户角色',
      description: '获取指定用户的角色列表',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'number', description: '用户ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: {
              type: 'array',
              items: { $ref: 'sysRole#' }
            },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { userId } = request.params as { userId: number }
        const roles = await roleService.getUserRoles(userId)

        return ResponseUtil.success(
          reply,
          request,
          roles,
          '获取成功'
        )
      } catch (error) {
        const msg = error instanceof Error ? error.message : '获取失败'

        if (error instanceof Error) {
          if (msg.includes('用户不存在')) {
            return ResponseUtil.error(reply, request, ErrorCode.USER_NOT_FOUND, '用户不存在')
          }
        }

        return ResponseUtil.error(reply, request, ErrorCode.SYSTEM_ERROR, msg)
      }
    }
  })

  // 获取角色用户列表
  fastify.get('/:id/users', {
    schema: {
      operationId: 'getRoleUsers',
      summary: '获取角色用户列表',
      description: '获取指定角色的用户列表',
      tags: ['sysRoles'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '角色ID' }
        }
      },
      querystring: { $ref: 'sysRoleUserQueryRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysRoleUserListResponse#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const query = request.query as any

        // TODO: 实现 getRoleUsers 方法
        // const { id } = request.params as { id: number }
        // const result = await roleService.getRoleUsers(id, query)
        
        // 临时返回空数据
        const result = {
          data: [],
          total: 0,
          page: query.page || 1,
          limit: query.limit || 10
        }
        
        return ResponseUtil.paginated(
          reply,
          request,
          result.data,
          result.total,
          result.page,
          result.limit,
          '获取成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })
}

export default roleRoutes
