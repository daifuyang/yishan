// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 医院微信绑定 GET /api/modules/crm/v1/public/weixin/bind */
export async function crmBindWechatOpenid(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmBindWechatOpenidParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/public/weixin/bind", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
