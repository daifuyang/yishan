import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService } from '../../../../services/crm.service.js'
import { CrmCustomerDto, CrmCustomerListQueryDto, CrmDispatchCreateDto } from '../../../../schemas/crm.js'

const customers: FastifyPluginAsync = async (fastify) => {
  fastify.get('/statuses', { preHandler: [fastify.requirePermission('crm:customer:list')] as any, schema: { summary: '客户状态', operationId: 'crmListCustomerStatuses', tags: ['crmCustomers'], security: [{ bearerAuth: [] }] } }, async (_, reply) => {
    return ResponseUtil.success(reply, await CrmService.listCustomerStatuses())
  })

  fastify.get('/', { preHandler: [fastify.requirePermission('crm:customer:list')] as any, schema: { summary: '客户列表', operationId: 'crmListCustomers', tags: ['crmCustomers'], security: [{ bearerAuth: [] }], querystring: { $ref: 'crmCustomerListQuery#' } } }, async (request: FastifyRequest<{ Querystring: CrmCustomerListQueryDto }>, reply) => {
    const result = await CrmService.listCustomers(request.query, request.currentUser.id)
    return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
  })

  fastify.get('/:id', { preHandler: [fastify.requirePermission('crm:customer:list')] as any, schema: { summary: '客户详情', operationId: 'crmGetCustomer', tags: ['crmCustomers'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' } } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const data = await CrmService.getCustomer(request.params.id, request.currentUser.id)
    if (!data) return ResponseUtil.error(reply, 20001, '客户不存在或无权访问')
    return ResponseUtil.success(reply, data)
  })

  fastify.post('/', { preHandler: [fastify.requirePermission('crm:customer:create')] as any, schema: { summary: '创建客户', operationId: 'crmCreateCustomer', tags: ['crmCustomers'], security: [{ bearerAuth: [] }], body: { $ref: 'crmCustomerReq#' } } }, async (request: FastifyRequest<{ Body: CrmCustomerDto }>, reply) => {
    const data = await CrmService.saveCustomer(request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '创建成功')
  })

  fastify.put('/:id', { preHandler: [fastify.requirePermission('crm:customer:update')] as any, schema: { summary: '更新客户', operationId: 'crmUpdateCustomer', tags: ['crmCustomers'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmCustomerUpdateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: Partial<CrmCustomerDto> }>, reply) => {
    const data = await CrmService.saveCustomer(request.body, request.currentUser.id, request.params.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.post('/:id/dispatch', { preHandler: [fastify.requirePermission('crm:customer:dispatch')] as any, schema: { summary: '客户派单', operationId: 'crmDispatchCustomer', tags: ['crmCustomers'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmDispatchCreateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: CrmDispatchCreateDto }>, reply) => {
    const data = await CrmService.dispatchCustomer(request.params.id, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '派单成功')
  })
}

export default customers
