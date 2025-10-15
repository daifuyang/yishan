// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 清除用户缓存 清除所有用户相关的缓存数据 DELETE /api/v1/admin/users/cache */
export async function deleteAdminUsersCache(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: null;
    timestamp?: string;
  }>("/api/v1/admin/users/cache", {
    method: "DELETE",
    ...(options || {}),
  });
}
