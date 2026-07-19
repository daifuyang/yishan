// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Hello 示例插件健康检查 验证插件 manifest、鉴权和管理端路由是否已正确加载 GET /api/plugins/yishan/hello/v1/admin/ */
export async function getHelloAdminHealth(options?: { [key: string]: any }) {
  return request<any>("/api/plugins/yishan/hello/v1/admin/", {
    method: "GET",
    ...(options || {}),
  });
}
