// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 文章模板列表 GET /api/portal/v1/article-templates */
export async function getPortalV1ArticleTemplates(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1ArticleTemplatesParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      name: string;
      description: string | null;
      type: number;
      schema?: any;
      config?: any;
      status: number;
      isSystemDefault: boolean;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    }[];
  }>("/api/portal/v1/article-templates", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建文章模板 POST /api/portal/v1/article-templates */
export async function postPortalV1ArticleTemplates(
  body: {
    name: string;
    description?: string;
    type: number;
    schema?: any;
    config?: any;
    status?: number;
    isSystemDefault?: boolean;
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    name: string;
    description: string | null;
    type: number;
    schema?: any;
    config?: any;
    status: number;
    isSystemDefault: boolean;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>("/api/portal/v1/article-templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 文章模板详情 GET /api/portal/v1/article-templates/${param0} */
export async function getPortalV1ArticleTemplatesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1ArticleTemplatesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    description: string | null;
    type: number;
    schema?: any;
    config?: any;
    status: number;
    isSystemDefault: boolean;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/article-templates/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除文章模板 DELETE /api/portal/v1/article-templates/${param0} */
export async function deletePortalV1ArticleTemplatesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePortalV1ArticleTemplatesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(
    `/api/portal/v1/article-templates/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新文章模板 PATCH /api/portal/v1/article-templates/${param0} */
export async function patchPortalV1ArticleTemplatesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchPortalV1ArticleTemplatesIdParams,
  body: {
    name?: string;
    description?: string;
    type?: number;
    schema?: any;
    config?: any;
    status?: number;
    isSystemDefault?: boolean;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    description: string | null;
    type: number;
    schema?: any;
    config?: any;
    status: number;
    isSystemDefault: boolean;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/article-templates/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 文章列表 GET /api/portal/v1/articles */
export async function getPortalV1Articles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1ArticlesParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      title: string;
      slug: string | null;
      summary: string | null;
      content: string;
      coverImage: string | null;
      status: number;
      isPinned: boolean;
      publishTime: string | null;
      tags?: string[];
      templateId: number | null;
      categoryIds?: number[];
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    }[];
  }>("/api/portal/v1/articles", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建文章 POST /api/portal/v1/articles */
export async function postPortalV1Articles(
  body: {
    title: string;
    slug?: string;
    summary?: string;
    content: string;
    coverImage?: string;
    status?: number;
    isPinned?: boolean;
    publishTime?: string;
    tags?: string[];
    templateId?: number | null;
    categoryIds?: number[];
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    title: string;
    slug: string | null;
    summary: string | null;
    content: string;
    coverImage: string | null;
    status: number;
    isPinned: boolean;
    publishTime: string | null;
    tags?: string[];
    templateId: number | null;
    categoryIds?: number[];
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>("/api/portal/v1/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 文章详情 GET /api/portal/v1/articles/${param0} */
export async function getPortalV1ArticlesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1ArticlesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    title: string;
    slug: string | null;
    summary: string | null;
    content: string;
    coverImage: string | null;
    status: number;
    isPinned: boolean;
    publishTime: string | null;
    tags?: string[];
    templateId: number | null;
    categoryIds?: number[];
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/articles/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除文章 DELETE /api/portal/v1/articles/${param0} */
export async function deletePortalV1ArticlesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePortalV1ArticlesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(`/api/portal/v1/articles/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新文章 PATCH /api/portal/v1/articles/${param0} */
export async function patchPortalV1ArticlesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchPortalV1ArticlesIdParams,
  body: {
    title?: string;
    slug?: string;
    summary?: string;
    content?: string;
    coverImage?: string;
    status?: number;
    isPinned?: boolean;
    publishTime?: string;
    tags?: string[];
    templateId?: number | null;
    categoryIds?: number[];
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    title: string;
    slug: string | null;
    summary: string | null;
    content: string;
    coverImage: string | null;
    status: number;
    isPinned: boolean;
    publishTime: string | null;
    tags?: string[];
    templateId: number | null;
    categoryIds?: number[];
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/articles/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 发布文章 POST /api/portal/v1/articles/${param0}/publish */
export async function postPortalV1ArticlesIdPublish(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postPortalV1ArticlesIdPublishParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(
    `/api/portal/v1/articles/${param0}/publish`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 分类列表 GET /api/portal/v1/categories */
export async function getPortalV1Categories(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1CategoriesParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      name: string;
      slug: string | null;
      parentId: number | null;
      status: number;
      sortOrder: number;
      description: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    }[];
  }>("/api/portal/v1/categories", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建分类 POST /api/portal/v1/categories */
export async function postPortalV1Categories(
  body: {
    name: string;
    slug?: string;
    parentId?: number | null;
    status?: number;
    sortOrder?: number;
    description?: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    name: string;
    slug: string | null;
    parentId: number | null;
    status: number;
    sortOrder: number;
    description: string | null;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>("/api/portal/v1/categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 分类详情 GET /api/portal/v1/categories/${param0} */
export async function getPortalV1CategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1CategoriesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    slug: string | null;
    parentId: number | null;
    status: number;
    sortOrder: number;
    description: string | null;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/categories/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除分类 DELETE /api/portal/v1/categories/${param0} */
export async function deletePortalV1CategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePortalV1CategoriesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(`/api/portal/v1/categories/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新分类 PATCH /api/portal/v1/categories/${param0} */
export async function patchPortalV1CategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchPortalV1CategoriesIdParams,
  body: {
    name?: string;
    slug?: string;
    parentId?: number | null;
    status?: number;
    sortOrder?: number;
    description?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    slug: string | null;
    parentId: number | null;
    status: number;
    sortOrder: number;
    description: string | null;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/categories/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 页面模板列表 GET /api/portal/v1/page-templates */
export async function getPortalV1PageTemplates(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1PageTemplatesParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      name: string;
      description: string | null;
      type: number;
      schema?: any;
      config?: any;
      status: number;
      isSystemDefault: boolean;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    }[];
  }>("/api/portal/v1/page-templates", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建页面模板 POST /api/portal/v1/page-templates */
export async function postPortalV1PageTemplates(
  body: {
    name: string;
    description?: string;
    type: number;
    schema?: any;
    config?: any;
    status?: number;
    isSystemDefault?: boolean;
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    name: string;
    description: string | null;
    type: number;
    schema?: any;
    config?: any;
    status: number;
    isSystemDefault: boolean;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>("/api/portal/v1/page-templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 页面模板详情 GET /api/portal/v1/page-templates/${param0} */
export async function getPortalV1PageTemplatesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1PageTemplatesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    description: string | null;
    type: number;
    schema?: any;
    config?: any;
    status: number;
    isSystemDefault: boolean;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/page-templates/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除页面模板 DELETE /api/portal/v1/page-templates/${param0} */
export async function deletePortalV1PageTemplatesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePortalV1PageTemplatesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(
    `/api/portal/v1/page-templates/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新页面模板 PATCH /api/portal/v1/page-templates/${param0} */
export async function patchPortalV1PageTemplatesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchPortalV1PageTemplatesIdParams,
  body: {
    name?: string;
    description?: string;
    type?: number;
    schema?: any;
    config?: any;
    status?: number;
    isSystemDefault?: boolean;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    description: string | null;
    type: number;
    schema?: any;
    config?: any;
    status: number;
    isSystemDefault: boolean;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/page-templates/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 页面列表 GET /api/portal/v1/pages */
export async function getPortalV1Pages(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1PagesParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      title: string;
      path: string;
      content: string;
      status: number;
      publishTime: string | null;
      templateId: number | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    }[];
  }>("/api/portal/v1/pages", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建页面 POST /api/portal/v1/pages */
export async function postPortalV1Pages(
  body: {
    title: string;
    path: string;
    content: string;
    status?: number;
    publishTime?: string;
    templateId?: number | null;
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    title: string;
    path: string;
    content: string;
    status: number;
    publishTime: string | null;
    templateId: number | null;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>("/api/portal/v1/pages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 页面详情 GET /api/portal/v1/pages/${param0} */
export async function getPortalV1PagesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPortalV1PagesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    title: string;
    path: string;
    content: string;
    status: number;
    publishTime: string | null;
    templateId: number | null;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/pages/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除页面 DELETE /api/portal/v1/pages/${param0} */
export async function deletePortalV1PagesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePortalV1PagesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(`/api/portal/v1/pages/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新页面 PATCH /api/portal/v1/pages/${param0} */
export async function patchPortalV1PagesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchPortalV1PagesIdParams,
  body: {
    title?: string;
    path?: string;
    content?: string;
    status?: number;
    publishTime?: string;
    templateId?: number | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    title: string;
    path: string;
    content: string;
    status: number;
    publishTime: string | null;
    templateId: number | null;
    creatorId: number | null;
    createdAt: string;
    updaterId: number | null;
    updatedAt: string;
  }>(`/api/portal/v1/pages/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
