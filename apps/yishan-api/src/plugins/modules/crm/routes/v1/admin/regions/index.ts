import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService } from '../../../../services/crm.service.js'
import { CrmRegionListQueryDto } from '../../../../schemas/crm.js'

const regions: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [fastify.requirePermission('crm:region:list')] as any, schema: { summary: '地区列表', operationId: 'crmListRegions', tags: ['crmRegions'], security: [{ bearerAuth: [] }], querystring: { $ref: 'crmRegionListQuery#' } } }, async (request: FastifyRequest<{ Querystring: CrmRegionListQueryDto }>, reply) => {
    return ResponseUtil.success(reply, await CrmService.listRegions(request.query.parentId || 0))
  })
}

export default regions
