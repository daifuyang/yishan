// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 上传附件 支持批量上传的表单文件（multipart/form-data） POST /api/v1/admin/attachments/ */
export async function uploadAttachments(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      path: string;
    }[];
    timestamp: string;
  }>("/api/v1/admin/attachments/", {
    method: "POST",
    ...(options || {}),
  });
}
