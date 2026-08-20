// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 插件健康检查 返回模块自身与运行环境的只读信息，用于演示 plugin 不读 db 的纯函数 service。 GET /api/demo/v1/info */
export async function demoInfo(options?: { [key: string]: any }) {
  return request<{
    module: "demo";
    nodeVersion: string;
    hostname: string;
    platform: string;
    arch: string;
    cpus: number;
    memory: { total: number; free: number };
    uptimeSeconds: number;
    pid: number;
    env: string;
    timestamp: string;
  }>("/api/demo/v1/info", {
    method: "GET",
    ...(options || {}),
  });
}

/** Todo 列表 GET /api/demo/v1/todos */
export async function demoTodosList(options?: { [key: string]: any }) {
  return request<{
    total: number;
    items: {
      id: number;
      title: string;
      description: string;
      status: number;
      dueAt: string | null;
      createdAt: string;
      updatedAt: string;
    }[];
  }>("/api/demo/v1/todos", {
    method: "GET",
    ...(options || {}),
  });
}

/** Todo 新建 POST /api/demo/v1/todos */
export async function demoTodosCreate(
  body: {
    title: string;
    description?: string;
    status?: number;
    dueAt?: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    title: string;
    description: string;
    status: number;
    dueAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>("/api/demo/v1/todos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Todo 详情 GET /api/demo/v1/todos/${param0} */
export async function demoTodosDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.demoTodosDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    title: string;
    description: string;
    status: number;
    dueAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>(`/api/demo/v1/todos/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Todo 删除 DELETE /api/demo/v1/todos/${param0} */
export async function demoTodosDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.demoTodosDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    title: string;
    description: string;
    status: number;
    dueAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>(`/api/demo/v1/todos/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Todo 更新 PATCH /api/demo/v1/todos/${param0} */
export async function demoTodosUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.demoTodosUpdateParams,
  body: {
    title?: string;
    description?: string;
    status?: number;
    dueAt?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    title: string;
    description: string;
    status: number;
    dueAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>(`/api/demo/v1/todos/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
