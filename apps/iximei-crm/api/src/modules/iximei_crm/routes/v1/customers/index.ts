/**
 * 客户资源路由。
 *
 * 单一职责：客户档案 + 客户状态字典 + 派单 + 备注（占位）。
 *
 * 数据权限（apps/yishan-api/docs/data-scope.md）：
 *   - SUPER_ADMIN/ADMIN (dataScope=1) → 看全部客户
 *   - 其他 (dataScope=4 SELF 等) → 只看自己 owner 的客户
 *   - rbac preHandler 已把 effectiveDataScope 写到 req.currentUser.dataScope
 */

import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { PERMS } from '../../../permissions.js'
import { CustomersService } from '../../../services/customers.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmCustomerDispatchReqSchema,
  CrmCustomerListQuerySchema,
  CrmCustomerRemarkReqSchema,
  CrmCustomerReqSchema,
  CrmCustomerUpdateReqSchema,
} from '../../../schemas/customers.schema.js'
import { CrmIdParamsSchema } from '../../../schemas/shared.schema.js'
import { currentCrmDataScope, type DataScopeCode } from '@/modules/iximei_crm/access-scope'

const customers: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const id = (req: any) => Number(req.params.id)
  const scope = async (_req: any): Promise<DataScopeCode> => currentCrmDataScope()

  route.get(
    '/customers/statuses',
    {
      access: { permission: PERMS.CUSTOMER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户状态字典',
        operationId: 'listCrmCustomerStatuses',
      },
    },
    async (_req: any, reply: any) => {
      const result = await CustomersService.listStatuses()
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/customers',
    {
      access: { permission: PERMS.CUSTOMER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户列表',
        operationId: 'listCrmCustomers',
        querystring: CrmCustomerListQuerySchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await CustomersService.list(req.query, uid(req), await scope(req))
      return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
    },
  )

  route.get(
    '/customers/:id',
    {
      access: { permission: PERMS.CUSTOMER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户详情',
        operationId: 'getCrmCustomer',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const data = await CustomersService.getById(id(req), uid(req), await scope(req))
      if (!data) return ResponseUtil.error(reply, 40401, '客户不存在')
      return ResponseUtil.success(reply, data)
    },
  )

  route.post(
    '/customers',
    {
      access: { permission: PERMS.CUSTOMER_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建客户',
        operationId: 'createCrmCustomer',
        body: CrmCustomerReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await CustomersService.save(req.body, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.patch(
    '/customers/:id',
    {
      access: { permission: PERMS.CUSTOMER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新客户',
        operationId: 'updateCrmCustomer',
        params: CrmIdParamsSchema,
        body: CrmCustomerUpdateReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await CustomersService.save(req.body, uid(req), await scope(req), id(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.post(
    '/customers/:id/dispatch',
    {
      access: { permission: PERMS.CUSTOMER_DISPATCH },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户派单',
        operationId: 'dispatchCrmCustomer',
        params: CrmIdParamsSchema,
        body: CrmCustomerDispatchReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await CustomersService.dispatch(id(req), req.body, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.post(
    '/customers/:id/remarks',
    {
      access: { permission: PERMS.CUSTOMER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户备注',
        operationId: 'createCrmCustomerRemark',
        params: CrmIdParamsSchema,
        body: CrmCustomerRemarkReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await CustomersService.addRemark(id(req), req.body.content, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.delete(
    '/customers/:id',
    {
      access: { permission: PERMS.CUSTOMER_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除客户',
        operationId: 'deleteCrmCustomer',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await CustomersService.delete(id(req), uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )
}

export default customers
