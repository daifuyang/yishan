// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 创建工作台菜单 创建工作台分组或应用入口 POST /api/v1/admin/app-menus/ */
export async function createAppMenu(
  body: SystemAPI.saveAppMenuReq,
  options?: { [key: string]: any }
) {
  return request<SystemAPI.appMenuDetailResp>("/api/v1/admin/app-menus/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取工作台菜单详情 根据ID获取工作台菜单详情 GET /api/v1/admin/app-menus/${param0} */
export async function getAppMenuDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.getAppMenuDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<SystemAPI.appMenuDetailResp>(
    `/api/v1/admin/app-menus/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新工作台菜单 根据ID更新工作台菜单 PUT /api/v1/admin/app-menus/${param0} */
export async function updateAppMenu(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.updateAppMenuParams,
  body: SystemAPI.updateAppMenuReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<SystemAPI.appMenuDetailResp>(
    `/api/v1/admin/app-menus/${param0}`,
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

/** 删除工作台菜单 软删除；分组下存在应用入口时禁止，删除时同步清理角色授权 DELETE /api/v1/admin/app-menus/${param0} */
export async function deleteAppMenu(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.deleteAppMenuParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<SystemAPI.appMenuDeleteResp>(
    `/api/v1/admin/app-menus/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 工作台菜单同级排序 按 orderedIds 的顺序重写该层级全部节点的 sortOrder（10、20、30…） POST /api/v1/admin/app-menus/reorder */
export async function reorderAppMenus(
  body: SystemAPI.reorderAppMenuReq,
  options?: { [key: string]: any }
) {
  return request<SystemAPI.appMenuReorderResp>(
    "/api/v1/admin/app-menus/reorder",
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

/** 获取工作台菜单树 获取全部工作台分组与应用入口，同级按 sortOrder 排序 GET /api/v1/admin/app-menus/tree */
export async function getAppMenuTree(options?: { [key: string]: any }) {
  return request<SystemAPI.appMenuTreeResp>("/api/v1/admin/app-menus/tree", {
    method: "GET",
    ...(options || {}),
  });
}
