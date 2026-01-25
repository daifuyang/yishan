// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取表单列表 分页获取应用内表单列表 GET /api/v1/admin/apps/${param0}/forms */
export async function getFormList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getFormListParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, ...queryParams } = params;
  return request<API.formListResp>(`/api/v1/admin/apps/${param0}/forms`, {
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
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 创建表单 在指定应用下创建表单 POST /api/v1/admin/apps/${param0}/forms */
export async function createForm(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createFormParams,
  body: API.createFormReq,
  options?: { [key: string]: any }
) {
  const { appId: param0, ...queryParams } = params;
  return request<API.formDetailResp>(`/api/v1/admin/apps/${param0}/forms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取表单详情 根据表单ID获取详情 GET /api/v1/admin/apps/${param0}/forms/${param1} */
export async function getFormDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getFormDetailParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, formId: param1, ...queryParams } = params;
  return request<API.formDetailResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新表单 根据表单ID更新表单 PUT /api/v1/admin/apps/${param0}/forms/${param1} */
export async function updateForm(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateFormParams,
  body: API.updateFormReq,
  options?: { [key: string]: any }
) {
  const { appId: param0, formId: param1, ...queryParams } = params;
  return request<API.formDetailResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}`,
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

/** 删除表单 根据表单ID软删除表单 DELETE /api/v1/admin/apps/${param0}/forms/${param1} */
export async function deleteForm(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteFormParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, formId: param1, ...queryParams } = params;
  return request<API.formDeleteResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取表单字段列表 分页获取表单字段列表 GET /api/v1/admin/apps/${param0}/forms/${param1}/fields */
export async function getFormFieldList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getFormFieldListParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, formId: param1, ...queryParams } = params;
  return request<API.formFieldListResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/fields`,
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
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 创建表单字段 为指定表单创建字段 POST /api/v1/admin/apps/${param0}/forms/${param1}/fields */
export async function createFormField(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createFormFieldParams,
  body: API.createFormFieldReq,
  options?: { [key: string]: any }
) {
  const { appId: param0, formId: param1, ...queryParams } = params;
  return request<API.formFieldDetailResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/fields`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取表单字段详情 根据字段ID获取详情 GET /api/v1/admin/apps/${param0}/forms/${param1}/fields/${param2} */
export async function getFormFieldDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getFormFieldDetailParams,
  options?: { [key: string]: any }
) {
  const {
    appId: param0,
    formId: param1,
    fieldId: param2,
    ...queryParams
  } = params;
  return request<API.formFieldDetailResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/fields/${param2}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新表单字段 根据字段ID更新表单字段 PUT /api/v1/admin/apps/${param0}/forms/${param1}/fields/${param2} */
export async function updateFormField(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateFormFieldParams,
  body: API.updateFormFieldReq,
  options?: { [key: string]: any }
) {
  const {
    appId: param0,
    formId: param1,
    fieldId: param2,
    ...queryParams
  } = params;
  return request<API.formFieldDetailResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/fields/${param2}`,
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

/** 删除表单字段 根据字段ID软删除表单字段 DELETE /api/v1/admin/apps/${param0}/forms/${param1}/fields/${param2} */
export async function deleteFormField(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteFormFieldParams,
  options?: { [key: string]: any }
) {
  const {
    appId: param0,
    formId: param1,
    fieldId: param2,
    ...queryParams
  } = params;
  return request<API.formFieldDeleteResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/fields/${param2}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取表单数据列表 分页获取表单数据列表 GET /api/v1/admin/apps/${param0}/forms/${param1}/records */
export async function getFormRecordList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getFormRecordListParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, formId: param1, ...queryParams } = params;
  return request<API.formRecordListResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/records`,
    {
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
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 创建表单数据 为指定表单创建数据 POST /api/v1/admin/apps/${param0}/forms/${param1}/records */
export async function createFormRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createFormRecordParams,
  body: API.createFormRecordReq,
  options?: { [key: string]: any }
) {
  const { appId: param0, formId: param1, ...queryParams } = params;
  return request<API.formRecordDetailResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/records`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取表单数据详情 根据数据ID获取详情 GET /api/v1/admin/apps/${param0}/forms/${param1}/records/${param2} */
export async function getFormRecordDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getFormRecordDetailParams,
  options?: { [key: string]: any }
) {
  const {
    appId: param0,
    formId: param1,
    recordId: param2,
    ...queryParams
  } = params;
  return request<API.formRecordDetailResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/records/${param2}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新表单数据 根据数据ID更新表单数据 PUT /api/v1/admin/apps/${param0}/forms/${param1}/records/${param2} */
export async function updateFormRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateFormRecordParams,
  body: API.updateFormRecordReq,
  options?: { [key: string]: any }
) {
  const {
    appId: param0,
    formId: param1,
    recordId: param2,
    ...queryParams
  } = params;
  return request<API.formRecordDetailResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/records/${param2}`,
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

/** 删除表单数据 根据数据ID软删除表单数据 DELETE /api/v1/admin/apps/${param0}/forms/${param1}/records/${param2} */
export async function deleteFormRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteFormRecordParams,
  options?: { [key: string]: any }
) {
  const {
    appId: param0,
    formId: param1,
    recordId: param2,
    ...queryParams
  } = params;
  return request<API.formRecordDeleteResp>(
    `/api/v1/admin/apps/${param0}/forms/${param1}/records/${param2}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
