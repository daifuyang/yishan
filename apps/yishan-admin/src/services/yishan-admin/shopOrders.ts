// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取订单列表 分页获取订单列表，支持关键词、状态等筛选 GET /api/modules/shop/v1/admin/orders/ */
export async function getOrderList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getOrderListParams,
  options?: { [key: string]: any }
) {
  return request<API.shopOrderListResp>("/api/modules/shop/v1/admin/orders/", {
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

/** 获取订单详情 根据订单ID获取订单详情 GET /api/modules/shop/v1/admin/orders/${param0} */
export async function getOrderDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getOrderDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.shopOrderDetailResp>(
    `/api/modules/shop/v1/admin/orders/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 删除订单 根据订单ID软删除订单 DELETE /api/modules/shop/v1/admin/orders/${param0} */
export async function deleteOrder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteOrderParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.shopIdResp>(
    `/api/modules/shop/v1/admin/orders/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 发货 更新物流信息 PUT /api/modules/shop/v1/admin/orders/${param0}/deliver */
export async function deliverOrder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deliverOrderParams,
  body: API.deliverOrderReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.shopOrderDetailResp>(
    `/api/modules/shop/v1/admin/orders/${param0}/deliver`,
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

/** 更新订单状态 更新订单状态 PUT /api/modules/shop/v1/admin/orders/${param0}/status */
export async function updateOrderStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateOrderStatusParams,
  body: API.shopUpdateOrderStatusReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.shopOrderDetailResp>(
    `/api/modules/shop/v1/admin/orders/${param0}/status`,
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
