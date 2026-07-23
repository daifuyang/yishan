// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 属性列表 GET /api/shop/v1/attributes */
export async function getShopV1Attributes(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1AttributesParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      name: string;
      type: number;
      sortOrder: number;
      status: number;
      createdAt: string;
      updatedAt: string;
    }[];
  }>("/api/shop/v1/attributes", {
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

/** 新建属性 POST /api/shop/v1/attributes */
export async function postShopV1Attributes(
  body: {
    name: string;
    type?: number;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    name: string;
    type: number;
    sortOrder: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }>("/api/shop/v1/attributes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 属性详情 GET /api/shop/v1/attributes/${param0} */
export async function getShopV1AttributesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1AttributesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    type: number;
    sortOrder: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/attributes/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除属性 DELETE /api/shop/v1/attributes/${param0} */
export async function deleteShopV1AttributesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteShopV1AttributesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(`/api/shop/v1/attributes/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新属性 PATCH /api/shop/v1/attributes/${param0} */
export async function patchShopV1AttributesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchShopV1AttributesIdParams,
  body: {
    name?: string;
    type?: number;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    type: number;
    sortOrder: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/attributes/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 属性值列表 GET /api/shop/v1/attributes/${param0}/values */
export async function getShopV1AttributesIdValues(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1AttributesIdValuesParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<
    {
      id: number;
      attributeId: number;
      value: string;
      image: string | null;
      sortOrder: number;
      status: number;
    }[]
  >(`/api/shop/v1/attributes/${param0}/values`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 新增属性值 POST /api/shop/v1/attributes/${param0}/values */
export async function postShopV1AttributesIdValues(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postShopV1AttributesIdValuesParams,
  body: {
    value: string;
    image?: string;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    attributeId: number;
    value: string;
    image: string | null;
    sortOrder: number;
    status: number;
  }>(`/api/shop/v1/attributes/${param0}/values`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 清空属性值 DELETE /api/shop/v1/attributes/${param0}/values */
export async function deleteShopV1AttributesIdValues(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteShopV1AttributesIdValuesParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(
    `/api/shop/v1/attributes/${param0}/values`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 分类列表 GET /api/shop/v1/categories */
export async function getShopV1Categories(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1CategoriesParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      name: string;
      parentId: number | null;
      coverImage: string | null;
      icon: string | null;
      description: string | null;
      sortOrder: number;
      status: number;
      createdAt: string;
      updatedAt: string;
    }[];
  }>("/api/shop/v1/categories", {
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

/** 新建分类 POST /api/shop/v1/categories */
export async function postShopV1Categories(
  body: {
    name: string;
    parentId?: number | null;
    coverImage?: string;
    icon?: string;
    description?: string;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    name: string;
    parentId: number | null;
    coverImage: string | null;
    icon: string | null;
    description: string | null;
    sortOrder: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }>("/api/shop/v1/categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 分类详情 GET /api/shop/v1/categories/${param0} */
export async function getShopV1CategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1CategoriesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    parentId: number | null;
    coverImage: string | null;
    icon: string | null;
    description: string | null;
    sortOrder: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/categories/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除分类 DELETE /api/shop/v1/categories/${param0} */
export async function deleteShopV1CategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteShopV1CategoriesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(`/api/shop/v1/categories/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新分类 PATCH /api/shop/v1/categories/${param0} */
export async function patchShopV1CategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchShopV1CategoriesIdParams,
  body: {
    name?: string;
    parentId?: number | null;
    coverImage?: string;
    icon?: string;
    description?: string;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    name: string;
    parentId: number | null;
    coverImage: string | null;
    icon: string | null;
    description: string | null;
    sortOrder: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/categories/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 订单列表 GET /api/shop/v1/orders */
export async function getShopV1Orders(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1OrdersParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      orderNo: string;
      userId: number;
      totalAmount: string;
      freightAmount: string;
      discountAmount: string;
      payAmount: string;
      payStatus: number;
      payTime: string | null;
      payMethod: string | null;
      orderStatus: number;
      expressCompany: string | null;
      expressNo: string | null;
      deliverTime: string | null;
      receiveTime: string | null;
      cancelReason: string | null;
      remark: string | null;
      items?: {
        id: number;
        orderId: number;
        productId: number;
        skuId: number | null;
        skuName: string | null;
        coverImage: string | null;
        productName: string;
        price: string;
        quantity: number;
        subtotal: string;
      }[];
      createdAt: string;
      updatedAt: string;
    }[];
  }>("/api/shop/v1/orders", {
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

/** 创建订单 POST /api/shop/v1/orders */
export async function postShopV1Orders(
  body: {
    orderNo: string;
    userId: number;
    totalAmount: string;
    freightAmount?: string;
    discountAmount?: string;
    payAmount: string;
    orderStatus?: number;
    remark?: string;
    items: {
      productId: number;
      skuId?: number | null;
      skuName?: string;
      coverImage?: string;
      productName: string;
      price: string;
      quantity: number;
      subtotal: string;
    }[];
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    orderNo: string;
    userId: number;
    totalAmount: string;
    freightAmount: string;
    discountAmount: string;
    payAmount: string;
    payStatus: number;
    payTime: string | null;
    payMethod: string | null;
    orderStatus: number;
    expressCompany: string | null;
    expressNo: string | null;
    deliverTime: string | null;
    receiveTime: string | null;
    cancelReason: string | null;
    remark: string | null;
    items?: {
      id: number;
      orderId: number;
      productId: number;
      skuId: number | null;
      skuName: string | null;
      coverImage: string | null;
      productName: string;
      price: string;
      quantity: number;
      subtotal: string;
    }[];
    createdAt: string;
    updatedAt: string;
  }>("/api/shop/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 订单详情 GET /api/shop/v1/orders/${param0} */
export async function getShopV1OrdersId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1OrdersIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    orderNo: string;
    userId: number;
    totalAmount: string;
    freightAmount: string;
    discountAmount: string;
    payAmount: string;
    payStatus: number;
    payTime: string | null;
    payMethod: string | null;
    orderStatus: number;
    expressCompany: string | null;
    expressNo: string | null;
    deliverTime: string | null;
    receiveTime: string | null;
    cancelReason: string | null;
    remark: string | null;
    items?: {
      id: number;
      orderId: number;
      productId: number;
      skuId: number | null;
      skuName: string | null;
      coverImage: string | null;
      productName: string;
      price: string;
      quantity: number;
      subtotal: string;
    }[];
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/orders/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除订单 DELETE /api/shop/v1/orders/${param0} */
export async function deleteShopV1OrdersId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteShopV1OrdersIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(`/api/shop/v1/orders/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新订单 PATCH /api/shop/v1/orders/${param0} */
export async function patchShopV1OrdersId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchShopV1OrdersIdParams,
  body: {
    orderStatus?: number;
    payStatus?: number;
    expressCompany?: string;
    expressNo?: string;
    cancelReason?: string;
    remark?: string;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    orderNo: string;
    userId: number;
    totalAmount: string;
    freightAmount: string;
    discountAmount: string;
    payAmount: string;
    payStatus: number;
    payTime: string | null;
    payMethod: string | null;
    orderStatus: number;
    expressCompany: string | null;
    expressNo: string | null;
    deliverTime: string | null;
    receiveTime: string | null;
    cancelReason: string | null;
    remark: string | null;
    items?: {
      id: number;
      orderId: number;
      productId: number;
      skuId: number | null;
      skuName: string | null;
      coverImage: string | null;
      productName: string;
      price: string;
      quantity: number;
      subtotal: string;
    }[];
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/orders/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 订单明细 GET /api/shop/v1/orders/${param0}/items */
export async function getShopV1OrdersIdItems(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1OrdersIdItemsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<
    {
      id: number;
      orderId: number;
      productId: number;
      skuId: number | null;
      skuName: string | null;
      coverImage: string | null;
      productName: string;
      price: string;
      quantity: number;
      subtotal: string;
    }[]
  >(`/api/shop/v1/orders/${param0}/items`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 商品列表 GET /api/shop/v1/products */
export async function getShopV1Products(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1ProductsParams,
  options?: { [key: string]: any }
) {
  return request<{
    total: number;
    page: number;
    pageSize: number;
    items: {
      id: number;
      categoryId: number;
      name: string;
      subtitle: string | null;
      coverImage: string | null;
      images?: any;
      description: string | null;
      price: string;
      costPrice: string | null;
      stock: number;
      unit: string;
      weight: string | null;
      status: number;
      isHot: boolean;
      isNew: boolean;
      sortOrder: number;
      clickCount: number;
      createdAt: string;
      updatedAt: string;
    }[];
  }>("/api/shop/v1/products", {
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

/** 新建商品 POST /api/shop/v1/products */
export async function postShopV1Products(
  body: {
    categoryId: number;
    name: string;
    subtitle?: string;
    coverImage?: string;
    images?: any;
    description?: string;
    price: string;
    costPrice?: string;
    stock?: number;
    unit?: string;
    weight?: string;
    status?: number;
    isHot?: boolean;
    isNew?: boolean;
    sortOrder?: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    id: number;
    categoryId: number;
    name: string;
    subtitle: string | null;
    coverImage: string | null;
    images?: any;
    description: string | null;
    price: string;
    costPrice: string | null;
    stock: number;
    unit: string;
    weight: string | null;
    status: number;
    isHot: boolean;
    isNew: boolean;
    sortOrder: number;
    clickCount: number;
    createdAt: string;
    updatedAt: string;
  }>("/api/shop/v1/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 商品详情 GET /api/shop/v1/products/${param0} */
export async function getShopV1ProductsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1ProductsIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    categoryId: number;
    name: string;
    subtitle: string | null;
    coverImage: string | null;
    images?: any;
    description: string | null;
    price: string;
    costPrice: string | null;
    stock: number;
    unit: string;
    weight: string | null;
    status: number;
    isHot: boolean;
    isNew: boolean;
    sortOrder: number;
    clickCount: number;
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/products/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除商品 DELETE /api/shop/v1/products/${param0} */
export async function deleteShopV1ProductsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteShopV1ProductsIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(`/api/shop/v1/products/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新商品 PATCH /api/shop/v1/products/${param0} */
export async function patchShopV1ProductsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchShopV1ProductsIdParams,
  body: {
    categoryId?: number;
    name?: string;
    subtitle?: string;
    coverImage?: string;
    images?: any;
    description?: string;
    price?: string;
    costPrice?: string;
    stock?: number;
    unit?: string;
    weight?: string;
    status?: number;
    isHot?: boolean;
    isNew?: boolean;
    sortOrder?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    categoryId: number;
    name: string;
    subtitle: string | null;
    coverImage: string | null;
    images?: any;
    description: string | null;
    price: string;
    costPrice: string | null;
    stock: number;
    unit: string;
    weight: string | null;
    status: number;
    isHot: boolean;
    isNew: boolean;
    sortOrder: number;
    clickCount: number;
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/products/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** SKU 列表 GET /api/shop/v1/products/${param0}/skus */
export async function getShopV1ProductsIdSkus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getShopV1ProductsIdSkusParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<
    {
      id: number;
      productId: number;
      skuCode: string;
      skuName: string;
      price: string;
      costPrice: string | null;
      stock: number;
      weight: string | null;
      coverImage: string | null;
      status: number;
      createdAt: string;
      updatedAt: string;
    }[]
  >(`/api/shop/v1/products/${param0}/skus`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 新增 SKU POST /api/shop/v1/products/${param0}/skus */
export async function postShopV1ProductsIdSkus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postShopV1ProductsIdSkusParams,
  body: {
    skuCode: string;
    skuName: string;
    price: string;
    costPrice?: string;
    stock?: number;
    weight?: string;
    coverImage?: string;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    productId: number;
    skuCode: string;
    skuName: string;
    price: string;
    costPrice: string | null;
    stock: number;
    weight: string | null;
    coverImage: string | null;
    status: number;
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/products/${param0}/skus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除 SKU DELETE /api/shop/v1/skus/${param0} */
export async function deleteShopV1SkusId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteShopV1SkusIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ success?: boolean }>(`/api/shop/v1/skus/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新 SKU PATCH /api/shop/v1/skus/${param0} */
export async function patchShopV1SkusId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchShopV1SkusIdParams,
  body: {
    skuCode?: string;
    skuName?: string;
    price?: string;
    costPrice?: string;
    stock?: number;
    weight?: string;
    coverImage?: string;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    id: number;
    productId: number;
    skuCode: string;
    skuName: string;
    price: string;
    costPrice: string | null;
    stock: number;
    weight: string | null;
    coverImage: string | null;
    status: number;
    createdAt: string;
    updatedAt: string;
  }>(`/api/shop/v1/skus/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
