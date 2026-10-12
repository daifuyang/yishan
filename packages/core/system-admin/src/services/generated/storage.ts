// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取云存储配置 获取当前云存储配置（用于后台配置页面展示） GET /api/v1/admin/system/storage/config */
export async function getStorageConfig(options?: { [key: string]: any }) {
  return request<SystemAPI.getStorageConfigResp>(
    "/api/v1/admin/system/storage/config",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 新增/更新云存储配置 新增或覆盖当前云存储配置（固定写入 systemStorage/qiniuConfig/aliyunOssConfig） PUT /api/v1/admin/system/storage/config */
export async function upsertStorageConfig(
  body: SystemAPI.upsertStorageConfigReq,
  options?: { [key: string]: any }
) {
  return request<SystemAPI.upsertStorageConfigResp>(
    "/api/v1/admin/system/storage/config",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 导出云存储配置 导出当前云存储配置（不包含 SecretKey 等敏感信息） GET /api/v1/admin/system/storage/export */
export async function exportStorageConfig(options?: { [key: string]: any }) {
  return request<SystemAPI.storageConfigExportResp>(
    "/api/v1/admin/system/storage/export",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 导入云存储配置 导入云存储配置（会覆盖当前配置） POST /api/v1/admin/system/storage/import */
export async function importStorageConfig(
  body: SystemAPI.storageConfigImportReq,
  options?: { [key: string]: any }
) {
  return request<SystemAPI.storageConfigImportResp>(
    "/api/v1/admin/system/storage/import",
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
