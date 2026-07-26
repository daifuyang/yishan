// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取活动功能/API 权限目录 GET /api/v1/admin/permissions/catalog */
export async function getPermissionCatalog(options?: { [key: string]: any }) {
  return request<API.permissionCatalogResp>(
    "/api/v1/admin/permissions/catalog",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}
