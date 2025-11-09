// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取岗位列表 分页获取系统岗位列表，支持关键词搜索和状态筛选 GET /api/v1/admin/posts/ */
export async function getPostList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPostListParams,
  options?: { [key: string]: any }
) {
  return request<API.postListResp>("/api/v1/admin/posts/", {
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
  });
}

/** 创建岗位 创建一个新的岗位 POST /api/v1/admin/posts/ */
export async function createPost(
  body: API.savePostReq,
  options?: { [key: string]: any }
) {
  return request<API.postDetailResp>("/api/v1/admin/posts/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取岗位详情 根据岗位ID获取岗位详情 GET /api/v1/admin/posts/${param0} */
export async function getPostDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPostDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.postDetailResp>(`/api/v1/admin/posts/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新岗位 根据岗位ID更新岗位信息 PUT /api/v1/admin/posts/${param0} */
export async function updatePost(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updatePostParams,
  body: API.updatePostReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.postDetailResp>(`/api/v1/admin/posts/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除岗位 根据岗位ID进行软删除 DELETE /api/v1/admin/posts/${param0} */
export async function deletePost(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePostParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.postDeleteResp>(`/api/v1/admin/posts/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
