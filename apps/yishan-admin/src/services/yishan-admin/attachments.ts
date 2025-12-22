// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取素材列表 分页获取素材列表，支持关键词、类型、分组与状态筛选 GET /api/v1/admin/attachments/ */
export async function getAttachmentList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAttachmentListParams,
  options?: { [key: string]: any }
) {
  return request<API.attachmentListResp>("/api/v1/admin/attachments/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      // sortBy has a default value: createdAt
      sortBy: "createdAt",
      // sortOrder has a default value: desc
      sortOrder: "desc",
      ...params,
    },
    ...(options || {}),
  });
}

/** 上传附件 支持批量上传的表单文件（multipart/form-data） POST /api/v1/admin/attachments/ */
export async function uploadAttachments(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.uploadAttachmentsParams,
  options?: { [key: string]: any }
) {
  return request<API.uploadAttachmentsResp>("/api/v1/admin/attachments/", {
    method: "POST",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 批量删除素材 根据素材ID列表进行软删除 DELETE /api/v1/admin/attachments/ */
export async function batchDeleteAttachments(
  body: API.attachmentBatchDeleteReq,
  options?: { [key: string]: any }
) {
  return request<API.attachmentBatchDeleteResp>("/api/v1/admin/attachments/", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取素材详情 根据素材ID获取素材详情 GET /api/v1/admin/attachments/${param0} */
export async function getAttachmentDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAttachmentDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.attachmentDetailResp>(
    `/api/v1/admin/attachments/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新素材 根据素材ID更新素材信息（名称、分组、状态、扩展信息） PUT /api/v1/admin/attachments/${param0} */
export async function updateAttachment(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateAttachmentParams,
  body: API.updateAttachmentReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.attachmentDetailResp>(
    `/api/v1/admin/attachments/${param0}`,
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

/** 删除素材 根据素材ID进行软删除 DELETE /api/v1/admin/attachments/${param0} */
export async function deleteAttachment(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteAttachmentParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.attachmentDeleteResp>(
    `/api/v1/admin/attachments/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 创建云端素材 云存储直传后创建素材记录 POST /api/v1/admin/attachments/cloud */
export async function createCloudAttachment(
  body: API.createCloudAttachmentReq,
  options?: { [key: string]: any }
) {
  return request<API.uploadAttachmentsResp>("/api/v1/admin/attachments/cloud", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取分组列表 分页获取素材分组列表，支持关键词、类型、状态与父级过滤 GET /api/v1/admin/attachments/folders */
export async function getAttachmentFolderList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAttachmentFolderListParams,
  options?: { [key: string]: any }
) {
  return request<API.attachmentFolderListResp>(
    "/api/v1/admin/attachments/folders",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        // pageSize has a default value: 10
        pageSize: "10",

        // sortBy has a default value: sort_order
        sortBy: "sort_order",
        // sortOrder has a default value: asc
        sortOrder: "asc",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建分组 创建一个新的素材分组 POST /api/v1/admin/attachments/folders */
export async function createAttachmentFolder(
  body: API.createAttachmentFolderReq,
  options?: { [key: string]: any }
) {
  return request<API.attachmentFolderDetailResp>(
    "/api/v1/admin/attachments/folders",
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

/** 获取分组详情 根据分组ID获取分组详情 GET /api/v1/admin/attachments/folders/${param0} */
export async function getAttachmentFolderDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAttachmentFolderDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.attachmentFolderDetailResp>(
    `/api/v1/admin/attachments/folders/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新分组 根据分组ID更新分组信息 PUT /api/v1/admin/attachments/folders/${param0} */
export async function updateAttachmentFolder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateAttachmentFolderParams,
  body: API.updateAttachmentFolderReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.attachmentFolderDetailResp>(
    `/api/v1/admin/attachments/folders/${param0}`,
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

/** 删除分组 根据分组ID进行软删除，存在子分组或素材禁止删除 DELETE /api/v1/admin/attachments/folders/${param0} */
export async function deleteAttachmentFolder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteAttachmentFolderParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.attachmentFolderDeleteResp>(
    `/api/v1/admin/attachments/folders/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取分组树 获取素材分组树形结构（按 sort_order 排序） GET /api/v1/admin/attachments/folders/tree */
export async function getAttachmentFolderTree(options?: {
  [key: string]: any;
}) {
  return request<API.attachmentFolderTreeResp>(
    "/api/v1/admin/attachments/folders/tree",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}
