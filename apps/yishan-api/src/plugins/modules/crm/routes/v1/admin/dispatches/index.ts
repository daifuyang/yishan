import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService } from '../../../../services/crm.service.js'
import { CrmContentDto, CrmDispatchDto, CrmDispatchReplyDto, CrmPageQueryDto } from '../../../../schemas/crm.js'

const dispatches: FastifyPluginAsync = async (fastify) => {
  fastify.get('/statuses', { preHandler: [fastify.requirePermission('crm:dispatch:list')] as any, schema: { summary: '派单状态', operationId: 'crmListDispatchStatuses', tags: ['crmDispatches'], security: [{ bearerAuth: [] }] } }, async (_, reply) => {
    return ResponseUtil.success(reply, await CrmService.listDispatchStatuses())
  })

  fastify.get('/', { preHandler: [fastify.requirePermission('crm:dispatch:list')] as any, schema: { summary: '派单列表', operationId: 'crmListDispatches', tags: ['crmDispatches'], security: [{ bearerAuth: [] }], querystring: { $ref: 'crmCustomerListQuery#' } } }, async (request: FastifyRequest<{ Querystring: CrmPageQueryDto & { statusId?: number } }>, reply) => {
    const result = await CrmService.listDispatches(request.query, request.currentUser.id)
    return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
  })

  fastify.get('/export', { preHandler: [fastify.requirePermission('crm:dispatch:list')] as any, schema: { summary: '导出派单', operationId: 'crmExportDispatches', tags: ['crmDispatches'], security: [{ bearerAuth: [] }], querystring: { $ref: 'crmPageQuery#' } } }, async (request: FastifyRequest<{ Querystring: CrmPageQueryDto }>, reply) => {
    const query = request.query
    const result = await CrmService.listDispatches({ ...query, pageSize: 0 }, request.currentUser.id)
    const header = ['会员编号', '派单医院', '客户名称', '性别', '客户电话', '客户手机', '详细地址', '整形项目', '派单时间', '派单客服', '当前状态']
    const rows = result.list.map((item: any) => [
      item.customer?.numberId,
      item.hospital?.hospitalName,
      item.customer?.name,
      item.customer?.gender === 1 ? '女' : '男',
      item.customer?.telphone,
      item.customer?.mobile,
      item.customer?.address,
      item.customer?.plastic,
      item.createdAt?.toISOString?.() || item.createdAt,
      item.customer?.owner?.username || item.customer?.owner?.realName,
      item.status?.name,
    ])
    const csv = [header, ...rows].map((row) => row.map((cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="dispatches.csv"').send(`\ufeff${csv}`)
  })

  fastify.get('/:id', { preHandler: [fastify.requirePermission('crm:dispatch:list')] as any, schema: { summary: '派单详情', operationId: 'crmGetDispatch', tags: ['crmDispatches'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' } } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const data = await CrmService.getDispatch(request.params.id, request.currentUser.id)
    if (!data) return ResponseUtil.error(reply, 20001, '派单不存在或无权访问')
    return ResponseUtil.success(reply, data)
  })

  fastify.put('/:id', { preHandler: [fastify.requirePermission('crm:dispatch:update')] as any, schema: { summary: '更新派单', operationId: 'crmUpdateDispatch', tags: ['crmDispatches'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmDispatchReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: CrmDispatchDto }>, reply) => {
    const data = await CrmService.updateDispatch(request.params.id, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.post('/:id/replies', { preHandler: [fastify.requirePermission('crm:dispatch:reply')] as any, schema: { summary: '派单回复', operationId: 'crmAddDispatchReply', tags: ['crmDispatches'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmDispatchReplyReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: CrmDispatchReplyDto }>, reply) => {
    const data = await CrmService.addDispatchReply(request.params.id, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '回复成功')
  })

  fastify.post('/:id/logs', { preHandler: [fastify.requirePermission('crm:dispatch:log')] as any, schema: { summary: '添加跟进日志', operationId: 'crmAddDispatchLog', tags: ['crmDispatches'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmContentReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: CrmContentDto }>, reply) => {
    const data = await CrmService.addDispatchLog(request.params.id, request.body.content, request.currentUser.id)
    return ResponseUtil.success(reply, data, '添加成功')
  })
}

export default dispatches
