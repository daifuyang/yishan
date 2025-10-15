import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { RoleService } from '../../../../../services/roleService.js'
import { CreateRoleDTO, UpdateRoleDTO, RoleQueryDTO, RoleStatus, AssignRoleDTO } from '../../../../../domain/role.js'
import { ResponseUtil } from '../../../../../utils/response.js'
import { CommonBusinessCode } from '../../../../../constants/business-code.js'

export default async function roleRoutes(fastify: FastifyInstance) {
  const roleService = new RoleService(fastify)

  // 创建角色
  fastify.post('/', {
    schema: {
      tags: ['sysRoles'],
      summary: '创建新角色',
      description: '创建一个新的系统角色',
      operationId: 'postAdminRoles',
      security: [{ bearerAuth: [] }],
      body: { $ref: 'sysRoleCreateRequest#' },
      response: {
        201: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20001 },
            message: { type: 'string', example: '角色创建成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysRole#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        409: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Body: CreateRoleDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const creatorId = request.user?.id
      const newRole = await roleService.createRole(request.body, creatorId)

      return ResponseUtil.send(
        reply,
        request,
        newRole,
        '角色创建成功',
        CommonBusinessCode.CREATED
      )
    } catch (error) {
      fastify.log.error(error)

      if (error instanceof Error) {
        if (error.message.includes('已存在')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            CommonBusinessCode.CONFLICT,
            error
          )
        }
      }

      return ResponseUtil.error(
        reply,
        request,
        '角色创建失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error
      )
    }
  })

  // 获取角色列表
  fastify.get('/', {
    schema: {
      tags: ['sysRoles'],
      summary: '获取角色列表',
      description: '获取系统角色列表，支持分页、搜索和排序',
      operationId: 'getRoleList',
      security: [{ bearerAuth: [] }],
      querystring: { $ref: 'sysRoleQueryRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '操作成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysRoleListResponse#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Querystring: RoleQueryDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const query = request.query as RoleQueryDTO

      // 参数验证和转换
      const validatedQuery: RoleQueryDTO = {
        page: Math.max(1, query.page || 1),
        pageSize: Math.max(1, Math.min(100, query.pageSize || 10)),
        search: query.search,
        name: query.name,
        code: query.code,
        type: query.type,
        status: query.status,
        sortBy: query.sortBy || 'sortOrder',
        sortOrder: query.sortOrder || 'asc'
      }

      const result = await roleService.getRoles(validatedQuery)
      return ResponseUtil.paginated(
        reply,
        request,
        result.roles,
        result.total,
        result.page,
        result.pageSize,
        '获取角色列表成功'
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '获取角色列表失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error
      )
    }
  })

  // 获取单个角色详情
  fastify.get('/:id', {
    schema: {
      tags: ['sysRoles'],
      summary: '获取角色详情',
      description: '根据ID获取角色的详细信息',
      operationId: 'getRoleDetail',
      security: [{ bearerAuth: [] }],
      params: { $ref: 'idParam#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '获取成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysRole#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const role = await roleService.getRoleById(request.params.id)

      if (!role) {
        return ResponseUtil.error(
          reply,
          request,
          '角色不存在',
          CommonBusinessCode.NOT_FOUND
        )
      }

      return ResponseUtil.send(
        reply,
        request,
        role,
        '获取角色详情成功',
        CommonBusinessCode.SUCCESS
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '获取角色详情失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error
      )
    }
  })

  // 更新角色
  fastify.put('/:id', {
    schema: {
      tags: ['sysRoles'],
      summary: '更新角色',
      description: '更新指定角色的信息',
      operationId: 'updateRole',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '角色ID' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 50, description: '角色名称' },
          description: { type: 'string', maxLength: 200, description: '角色描述' },
          status: { type: 'number', enum: [0, 1], description: '状态：0-禁用，1-启用' },
          sortOrder: { type: 'number', minimum: 0, description: '排序顺序' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20002 },
            message: { type: 'string', example: '角色更新成功' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number', description: '角色ID' },
                roleName: { type: 'string', description: '角色名称' },
                roleDesc: { type: 'string', description: '角色描述' },
                status: { type: 'number', description: '状态' },
                isSystemRole: { type: 'number', description: '是否系统角色' },
                sortOrder: { type: 'number', description: '排序顺序' },
                createdAt: { type: 'string', format: 'date-time', description: '创建时间' },
                updatedAt: { type: 'string', format: 'date-time', description: '更新时间' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40003 },
            message: { type: 'string', example: '角色不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number }, Body: UpdateRoleDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const updaterId = request.user?.id
      const updatedRole = await roleService.updateRole(request.params.id, request.body, updaterId)

      if (!updatedRole) {
        return ResponseUtil.error(
          reply,
          request,
          '角色不存在',
          CommonBusinessCode.NOT_FOUND
        )
      }

      return ResponseUtil.send(
        reply,
        request,
        updatedRole,
        '角色更新成功',
        CommonBusinessCode.UPDATED
      )
    } catch (error) {
      fastify.log.error(error)

      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            CommonBusinessCode.NOT_FOUND,
            error
          )
        }
        if (error.message.includes('已存在')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            CommonBusinessCode.CONFLICT,
            error
          )
        }
      }

      return ResponseUtil.error(
        reply,
        request,
        '角色更新失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error
      )
    }
  })

  // 删除角色
  fastify.delete('/:id', {
    schema: {
      tags: ['sysRoles'],
      summary: '删除角色',
      description: '删除指定的角色',
      operationId: 'deleteRole',
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
            code: { type: 'number', example: 20003 },
            message: { type: 'string', example: '角色删除成功' }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40003 },
            message: { type: 'string', example: '角色不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const deleterId = request.user?.id
      const result = await roleService.deleteRole(request.params.id, deleterId)

      if (!result) {
        return ResponseUtil.error(
          reply,
          request,
          '角色不存在',
          CommonBusinessCode.NOT_FOUND
        )
      }

      return ResponseUtil.send(
        reply,
        request,
        null,
        '角色删除成功',
        CommonBusinessCode.DELETED
      )
    } catch (error) {
      fastify.log.error(error)

      if (error instanceof Error && error.message.includes('不存在')) {
        return ResponseUtil.error(
          reply,
          request,
          error.message,
          CommonBusinessCode.NOT_FOUND,
          error
        )
      }

      return ResponseUtil.error(
        reply,
        request,
        '角色删除失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error
      )
    }
  })

  // 修改角色状态
  fastify.patch('/:id/status', {
    schema: {
      tags: ['sysRoles'],
      summary: '修改角色状态',
      description: '修改指定角色的状态',
      operationId: 'updateRoleStatus',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '角色ID' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'number', enum: [0, 1], description: '状态：0-禁用，1-启用' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20002 },
            message: { type: 'string', example: '状态修改成功' }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40003 },
            message: { type: 'string', example: '角色不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number }, Body: { status: RoleStatus } }>,
    reply: FastifyReply
  ) => {
    try {
      const updaterId = request.user?.id
      const result = await roleService.changeRoleStatus(request.params.id, request.body.status, updaterId)

      if (!result) {
        return ResponseUtil.error(
          reply,
          request,
          '角色不存在',
          CommonBusinessCode.NOT_FOUND
        )
      }

      return ResponseUtil.send(
        reply,
        request,
        null,
        '角色状态修改成功',
        CommonBusinessCode.UPDATED
      )
    } catch (error) {
      fastify.log.error(error)

      if (error instanceof Error && error.message.includes('不存在')) {
        return ResponseUtil.error(
          reply,
          request,
          error.message,
          CommonBusinessCode.NOT_FOUND,
          error
        )
      }

      return ResponseUtil.error(
        reply,
        request,
        '角色状态修改失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error
      )
    }
  })

  // 为用户分配角色
  fastify.post('/assign', {
    schema: {
      tags: ['sysRoles'],
      summary: '为用户分配角色',
      description: '为指定用户分配一个或多个角色',
      operationId: 'assignRolesToUser',
      security: [{ bearerAuth: [] }],
      body: { $ref: 'sysRoleAssignRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '角色分配成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { type: 'boolean', example: true }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Body: AssignRoleDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const assignedBy = request.user?.id
      const assignData = {
        ...request.body,
        assignedBy
      }

      await roleService.assignRolesToUser(assignData)

      return ResponseUtil.send(
        reply,
        request,
        null,
        '角色分配成功',
        CommonBusinessCode.SUCCESS
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '角色分配失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error
      )
    }
  })

  // 获取用户的角色列表
  fastify.get('/user/:userId', {
    schema: {
      tags: ['sysRoles'],
      summary: '获取用户角色',
      description: '获取指定用户的角色列表',
      operationId: 'getUserRoles',
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
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '获取成功' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', description: '角色ID' },
                  roleName: { type: 'string', description: '角色名称' },
                  roleDesc: { type: 'string', description: '角色描述' },
                  status: { type: 'number', description: '状态' },
                  isSystemRole: { type: 'number', description: '是否系统角色' }
                }
              }
            }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { userId: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const roles = await roleService.getUserRoles(request.params.userId)

      return ResponseUtil.send(
        reply,
        request,
        roles,
        '获取用户角色成功',
        CommonBusinessCode.SUCCESS
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '获取用户角色失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error
      )
    }
  })
}