import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService } from '../../../../services/crm.service.js'
import { CrmHospitalAccountAssignDto, CrmHospitalAccountCreateDto, CrmHospitalAccountUpdateDto, CrmHospitalDto, CrmHospitalSearchQueryDto, CrmPageQueryDto } from '../../../../schemas/crm.js'

const hospitals: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [fastify.requirePermission('crm:hospital:list')] as any, schema: { summary: '医院列表', operationId: 'crmListHospitals', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], querystring: { $ref: 'crmPageQuery#' } } }, async (request: FastifyRequest<{ Querystring: CrmPageQueryDto & { status?: string } }>, reply: FastifyReply) => {
    const result = await CrmService.listHospitals(request.query)
    return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total, '获取成功')
  })

  fastify.get('/:id', { preHandler: [fastify.requirePermission('crm:hospital:list')] as any, schema: { summary: '医院详情', operationId: 'crmGetHospital', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' } } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const data = await CrmService.getHospital(request.params.id)
    if (!data) return ResponseUtil.error(reply, 20001, '医院不存在')
    return ResponseUtil.success(reply, data)
  })

  fastify.post('/', { preHandler: [fastify.requirePermission('crm:hospital:create')] as any, schema: { summary: '创建医院', operationId: 'crmCreateHospital', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], body: { $ref: 'crmHospitalReq#' } } }, async (request: FastifyRequest<{ Body: CrmHospitalDto }>, reply) => {
    const data = await CrmService.saveHospital(request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '创建成功')
  })

  fastify.put('/:id', { preHandler: [fastify.requirePermission('crm:hospital:update')] as any, schema: { summary: '更新医院', operationId: 'crmUpdateHospital', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmHospitalUpdateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: Partial<CrmHospitalDto> }>, reply) => {
    const data = await CrmService.saveHospital(request.body, request.currentUser.id, request.params.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.delete('/:id', { preHandler: [fastify.requirePermission('crm:hospital:delete')] as any, schema: { summary: '删除医院', operationId: 'crmDeleteHospital', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' } } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    await CrmService.deleteHospital(request.params.id, request.currentUser.id)
    return ResponseUtil.success(reply, { id: request.params.id }, '删除成功')
  })

  fastify.get('/search/options', { preHandler: [fastify.requirePermission('crm:hospital:list')] as any, schema: { summary: '医院搜索', operationId: 'crmSearchHospitals', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], querystring: { $ref: 'crmHospitalSearchQuery#' } } }, async (request: FastifyRequest<{ Querystring: CrmHospitalSearchQueryDto }>, reply) => {
    const query = request.query
    const result = await CrmService.listHospitals({ pageSize: 50, keyword: query.keyword })
    return ResponseUtil.success(reply, result.list)
  })

  fastify.get('/:id/accounts', { preHandler: [fastify.requirePermission('crm:hospital:list')] as any, schema: { summary: '获取医院账号列表', operationId: 'crmListHospitalAccounts', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' } } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const accounts = await CrmService.listHospitalAccounts(request.params.id)
    return ResponseUtil.success(reply, accounts)
  })

  fastify.post('/:id/accounts', { preHandler: [fastify.requirePermission('crm:hospital:update')] as any, schema: { summary: '新建账号并分配', operationId: 'crmCreateHospitalAccount', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmHospitalAccountCreateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: CrmHospitalAccountCreateDto }>, reply) => {
    const data = await CrmService.createHospitalAccount(request.params.id, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '创建成功')
  })

  fastify.post('/:id/accounts/assign', { preHandler: [fastify.requirePermission('crm:hospital:update')] as any, schema: { summary: '分配已有账号', operationId: 'crmAssignHospitalAccount', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmHospitalAccountAssignReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: CrmHospitalAccountAssignDto }>, reply) => {
    const data = await CrmService.assignHospitalAccount(request.params.id, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '分配成功')
  })

  fastify.put('/:id/accounts/:userId', { preHandler: [fastify.requirePermission('crm:hospital:update')] as any, schema: { summary: '更新医院内身份', operationId: 'crmUpdateHospitalAccount', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], params: { $ref: 'crmHospitalAccountParams#' }, body: { $ref: 'crmHospitalAccountUpdateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number; userId: number }; Body: CrmHospitalAccountUpdateDto }>, reply) => {
    const data = await CrmService.updateHospitalAccount(request.params.id, request.params.userId, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.delete('/:id/accounts/:userId', { preHandler: [fastify.requirePermission('crm:hospital:update')] as any, schema: { summary: '解除分配', operationId: 'crmDeleteHospitalAccount', tags: ['crmHospitals'], security: [{ bearerAuth: [] }], params: { $ref: 'crmHospitalAccountParams#' } } }, async (request: FastifyRequest<{ Params: { id: number; userId: number } }>, reply) => {
    await CrmService.deleteHospitalAccount(request.params.id, request.params.userId, request.currentUser.id)
    return ResponseUtil.success(reply, { id: request.params.userId }, '解除成功')
  })
}

export default hospitals
