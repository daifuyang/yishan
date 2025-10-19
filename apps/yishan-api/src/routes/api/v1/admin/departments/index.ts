import { FastifyPluginAsync } from 'fastify'
import { DepartmentService } from '../../../../../services/departmentService.js'
import { ErrorCode } from '../../../../../constants/business-code.js'
import { ResponseUtil } from '../../../../../utils/response.js'

const departmentRoutes: FastifyPluginAsync = async function (fastify, opts) {
  const departmentService = new DepartmentService(fastify)

  // 创建部门
  fastify.post('/', {
    schema: {
      summary: '创建部门',
      description: '创建新的部门',
      tags: ['sysDepartments'],
      security: [{ bearerAuth: [] }],
      body: { $ref: 'sysDepartmentCreateRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '创建成功' },
            data: { $ref: 'sysDepartment#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        409: { $ref: 'errorResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const body = request.body as any
        const userId = (request.user as any).id

        const createData = {
          ...body,
          creatorId: userId
        }

        const department = await departmentService.createDepartment(createData)
        
        return ResponseUtil.success(
          reply,
          request,
          department,
          '创建成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '创建失败'
        const errorCode = (error as any)?.code
        // 部门重名（同级）返回业务码 31002，HTTP 409（同时捕获数据库唯一约束错误）
        if (
          errorMessage.includes('同级别下已存在相同名称的部门') ||
          errorMessage.includes('名称重复') ||
          errorMessage.includes('Duplicate entry') ||
          errorCode === 'ER_DUP_ENTRY'
        ) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.DEPARTMENT_ALREADY_EXISTS,
            '部门名称重复'
          )
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

  // 获取部门列表
  fastify.get('/', {
    schema: {
      summary: '获取部门列表',
      description: '获取部门列表，支持分页和筛选',
      tags: ['sysDepartments'],
      security: [{ bearerAuth: [] }],
      querystring: { $ref: 'sysDepartmentQueryRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysDepartmentListResponse#' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const query = request.query as any
        const result = await departmentService.getDepartmentList(query)
        
        return ResponseUtil.paginated(
          reply,
          request,
          result.departments,
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

  // 获取部门树结构
  fastify.get('/tree', {
    schema: {
      summary: '获取部门树结构',
      description: '获取完整的部门树结构',
      tags: ['sysDepartments'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysDepartmentTreeResponse#' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const tree = await departmentService.getDepartmentTree()
        
        return ResponseUtil.success(
          reply,
          request,
          tree,
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

  // 根据ID获取部门详情
  fastify.get('/:id', {
    schema: {
      summary: '获取部门详情',
      description: '根据ID获取部门详细信息',
      tags: ['sysDepartments'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '部门ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysDepartment#' }
          }
        },
        404: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const department = await departmentService.getDepartmentById(id)
        
        if (!department) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.DEPARTMENT_NOT_FOUND,
            '部门不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          department,
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

  // 更新部门信息
  fastify.put('/:id', {
    schema: {
      summary: '更新部门信息',
      description: '根据ID更新部门信息',
      tags: ['sysDepartments'],
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysDepartmentIdParam#' },
      body: { $ref: 'sysDepartmentUpdateRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '更新成功' },
            data: { $ref: 'sysDepartment#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        409: { $ref: 'errorResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const body = request.body as any
        const userId = (request.user as any).id

        const updateData = {
          ...body,
          updaterId: userId
        }

        const department = await departmentService.updateDepartment(id, updateData)
        
        if (!department) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.DEPARTMENT_NOT_FOUND,
            '部门不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          department,
          '更新成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '更新失败'
        const errorCode = (error as any)?.code
        // 重复部门名（同级别）返回业务码 31002，HTTP 409（同时捕获数据库唯一约束错误）
        if (
          errorMessage.includes('同级别下已存在相同名称的部门') ||
          errorMessage.includes('名称重复') ||
          errorMessage.includes('Duplicate entry') ||
          errorCode === 'ER_DUP_ENTRY'
        ) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.DEPARTMENT_ALREADY_EXISTS,
            '部门名称重复'
          )
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

  // 更新部门状态
  fastify.put('/:id/status', {
    schema: {
      summary: '更新部门状态',
      description: '启用或禁用部门',
      tags: ['sysDepartments'],
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysDepartmentIdParam#' },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'number', enum: [0, 1] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '状态更新成功' },
            data: { $ref: 'sysDepartment#' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' },
        409: { $ref: 'errorResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const { status } = request.body as { status: number }
        const userId = (request.user as any).id

        const department = await departmentService.updateDepartmentStatus(id, status, userId)
        
        if (!department) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.DEPARTMENT_NOT_FOUND,
            '部门不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          department,
          '状态更新成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '状态更新失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 删除部门
  fastify.delete('/:id', {
    schema: {
      summary: '删除部门',
      description: '软删除部门',
      tags: ['sysDepartments'],
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysDepartmentIdParam#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '删除成功' },
            data: { type: 'object', properties: { success: { type: 'boolean' } } }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const userId = (request.user as any).id

        const result = await departmentService.deleteDepartment(id, userId)
        
        return ResponseUtil.success(
          reply,
          request,
          { success: result },
          '删除成功'
        )
      } catch (error) {
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
}

export default departmentRoutes
