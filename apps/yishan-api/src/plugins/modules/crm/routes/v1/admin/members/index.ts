import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService } from '../../../../services/crm.service.js'
import { CrmContentDto, CrmMemberDto, CrmPageQueryDto } from '../../../../schemas/crm.js'

export default (async (fastify) => {
  fastify.get('/', { preHandler: [fastify.requirePermission('crm:member:list')] as any, schema: { summary: '会员列表', operationId: 'crmListMembers', tags: ['crmMembers'], security: [{ bearerAuth: [] }], querystring: { $ref: 'crmPageQuery#' } } }, async (request: FastifyRequest<{ Querystring: CrmPageQueryDto }>, reply) => {
    const result = await CrmService.listMembers(request.query, request.currentUser.id)
    return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
  })

  fastify.get('/:id', { preHandler: [fastify.requirePermission('crm:member:list')] as any, schema: { summary: '会员详情', operationId: 'crmGetMember', tags: ['crmMembers'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' } } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const data = await CrmService.getMember(request.params.id, request.currentUser.id, true)
    if (!data) return ResponseUtil.error(reply, 20001, '会员不存在或无权访问')
    return ResponseUtil.success(reply, data)
  })

  fastify.post('/', { preHandler: [fastify.requirePermission('crm:member:create')] as any, schema: { summary: '创建会员', operationId: 'crmCreateMember', tags: ['crmMembers'], security: [{ bearerAuth: [] }], body: { $ref: 'crmMemberReq#' } } }, async (request: FastifyRequest<{ Body: CrmMemberDto }>, reply) => {
    const data = await CrmService.saveMember(request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '创建成功')
  })

  fastify.put('/:id', { preHandler: [fastify.requirePermission('crm:member:update')] as any, schema: { summary: '更新会员', operationId: 'crmUpdateMember', tags: ['crmMembers'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmMemberUpdateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: Partial<CrmMemberDto> }>, reply) => {
    const data = await CrmService.saveMember(request.body, request.currentUser.id, request.params.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.post('/:id/remarks', { preHandler: [fastify.requirePermission('crm:member:remark')] as any, schema: { summary: '添加会员备注', operationId: 'crmAddMemberRemark', tags: ['crmMembers'], security: [{ bearerAuth: [] }], params: { $ref: 'crmIdParams#' }, body: { $ref: 'crmContentReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: CrmContentDto }>, reply) => {
    const data = await CrmService.addMemberRemark(request.params.id, request.body.content, request.currentUser.id)
    return ResponseUtil.success(reply, data, '添加成功')
  })
}) satisfies FastifyPluginAsync
