// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取系统参数 根据键获取系统参数值 GET /api/v1/admin/system/options/${param0} */
export async function getSystemOption(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getSystemOptionParams,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.getSystemOptionResp>(
    `/api/v1/admin/system/options/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 设置系统参数 根据键设置系统参数值 PUT /api/v1/admin/system/options/${param0} */
export async function setSystemOption(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.setSystemOptionParams,
  body: API.setSystemOptionReq,
  options?: { [key: string]: any }
) {
  const { key: param0, ...queryParams } = params;
  return request<API.getSystemOptionResp>(
    `/api/v1/admin/system/options/${param0}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 批量设置系统参数 传入JSON数组批量新增或更新系统参数 POST /api/v1/admin/system/options/batch */
export async function batchSetSystemOption(
  body: API.batchSetSystemOptionReq,
  options?: { [key: string]: any }
) {
  return request<API.batchSetSystemOptionResp>(
    "/api/v1/admin/system/options/batch",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 批量获取系统参数（QueryString） 通过 query 参数 ?key=a&key=b 批量获取系统参数值 GET /api/v1/admin/system/options/query */
export async function batchGetSystemOptionByQuery(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.batchGetSystemOptionByQueryParams,
  options?: { [key: string]: any }
) {
  return request<API.batchGetSystemOptionResp>(
    "/api/v1/admin/system/options/query",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取七牛云上传临时凭证 根据七牛云官方文档生成上传凭证（uptoken） GET /api/v1/admin/system/qiniu/token */
export async function getQiniuUploadToken(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getQiniuUploadTokenParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      token: string;
      bucket: string;
      scope: string;
      deadline: number;
      expiresIn: number;
      uploadUrl: string;
    };
    timestamp: string;
  }>("/api/v1/admin/system/qiniu/token", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 清理过期token 定时任务接口，用于清理过期的用户token，需要特殊的定时任务令牌进行鉴权 POST /api/v1/system/cleanup-tokens */
export async function cleanupTokens(
  body: API.cleanupTokensReq,
  options?: { [key: string]: any }
) {
  return request<API.cleanupTokensResp>("/api/v1/system/cleanup-tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取token统计信息 获取系统中token的统计信息，包括总数、活跃数、过期数等 GET /api/v1/system/token-stats */
export async function getTokenStats(options?: { [key: string]: any }) {
  return request<API.tokenStatsResp>("/api/v1/system/token-stats", {
    method: "GET",
    ...(options || {}),
  });
}
