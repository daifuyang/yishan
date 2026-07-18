// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 我的 API Token 列表 GET /api/v1/me/api-tokens/ */
export async function meListApiTokens(options?: { [key: string]: any }) {
  return request<API.apiTokenListResp>("/api/v1/me/api-tokens/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 创建 API Token 为当前用户创建一个新的 API Token。明文 token 仅在创建时返回一次。过期时间可通过 duration 预设或 expiresAt 自定义(互斥),都不传默认为 30d。 POST /api/v1/me/api-tokens/ */
export async function meCreateApiToken(
  body: API.apiTokenCreateReq,
  options?: { [key: string]: any }
) {
  return request<API.apiTokenCreateResp>("/api/v1/me/api-tokens/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取单个 API Token GET /api/v1/me/api-tokens/${param0} */
export async function meGetApiToken(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.meGetApiTokenParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.apiTokenRecordResp>(`/api/v1/me/api-tokens/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 撤销 API Token DELETE /api/v1/me/api-tokens/${param0} */
export async function meRevokeApiToken(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.meRevokeApiTokenParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.apiTokenDeleteResp>(`/api/v1/me/api-tokens/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取当前用户可授予的权限范围 返回当前用户可授予的权限列表，按 system/shop/portal/special 分组。仅返回用户当前持有的且在系统中已登记的权限码。 GET /api/v1/me/api-tokens/available-scopes */
export async function meListAvailableScopes(options?: { [key: string]: any }) {
  return request<API.availableScopesResp>(
    "/api/v1/me/api-tokens/available-scopes",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}
