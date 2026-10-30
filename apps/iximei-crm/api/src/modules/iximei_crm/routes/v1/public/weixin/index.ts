/**
 * 公共 weixin 路由。
 *
 * 单一职责：微信小程序侧的医院账号绑定（带 md5 签名校验）。
 *
 * 关于 `access.permission`：
 *   `createRouteRegistrar` 当前不放行纯 public 类型，仅放过 BYPASS_CODES 列表里的 perm。
 *   临时用 HOSPITAL_UPDATE 作占位 —— 服务层 `bindWechatOpenid` 会再做 md5 签名校验。
 *   真要 public 接入的话需要把 `'crm:weixin:bind'` 加进 BYPASS_CODES。详见 TODO-crm-modules-followup.md。
 */

import { Type, type Static } from '@sinclair/typebox'
import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { PERMS } from '../../../../permissions.js'
import { HospitalsService } from '../../../../services/hospitals.service.js'
import { ROUTE_TAG } from '../../../../schemas/routes.schema.js'

const CrmWeixinBindQuerystringSchema = Type.Object({
  hospital_id: Type.Integer({ minimum: 1 }),
  openid: Type.String({ minLength: 1, maxLength: 64 }),
  signature: Type.String({ minLength: 1, maxLength: 64 }),
})
type WeixinBindQuery = Static<typeof CrmWeixinBindQuerystringSchema>

const weixin: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  void HospitalsService

  route.get(
    '/public/weixin/hospital-bind',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '微信绑定医院（小程序端签名校验）',
        description:
          '签名校验：md5("hospital_bind" + hospital_id)。当前 PERM 是占位，业务侧会再做签名校验。',
        operationId: 'bindCrmWeixinHospital',
        querystring: CrmWeixinBindQuerystringSchema,
      },
    },
    async (req: any) => {
      const q = req.query as WeixinBindQuery
      return HospitalsService.bindWechatOpenid(q.hospital_id, q.signature, q.openid)
    },
  )
}

export default weixin
