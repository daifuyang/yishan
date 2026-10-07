// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 按 id 获取跟进记录 GET /api/crm/v1/activities/${param0} */
export async function crmActivityGet(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmActivityGetParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number | null;
      contactId: number | null;
      entityType: "customer" | "opportunity" | "contract" | null;
      entityId: number | null;
      entityRefType: string | null;
      category: "follow_up" | "system" | "business";
      type: string;
      content: string;
      occurredAt: string;
      nextFollowUpAt: string | null;
      result: string | null;
      nextFollowUpPlan: string | null;
      attachmentIds: number[] | null;
      metadata: Record<string, any> | null;
      plannedAt: string | null;
      location: string | null;
      participants: string | null;
      visitResultCode: string | null;
      summary: string | null;
      operatorUserId: number;
      operatorUserName: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/activities/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除跟进记录（软删） DELETE /api/crm/v1/activities/${param0} */
export async function crmActivityDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmActivityDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/activities/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 编辑跟进记录 PATCH /api/crm/v1/activities/${param0} */
export async function crmActivityUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmActivityUpdateParams,
  body: {
    contactId?: number | null;
    type?: "phone" | "wechat" | "visit" | "email" | "meeting" | "other";
    content?: string;
    occurredAt?: string;
    nextFollowUpAt?: string | null;
    result?:
      | "continue"
      | "interested"
      | "not_now"
      | "unreachable"
      | "invalid"
      | null;
    nextFollowUpPlan?: string | null;
    attachmentIds?: number[] | null;
    metadata?: Record<string, any> | null;
    plannedAt?: string | null;
    location?: string | null;
    participants?: string | null;
    visitResultCode?: string | null;
    summary?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number | null;
      contactId: number | null;
      entityType: "customer" | "opportunity" | "contract" | null;
      entityId: number | null;
      entityRefType: string | null;
      category: "follow_up" | "system" | "business";
      type: string;
      content: string;
      occurredAt: string;
      nextFollowUpAt: string | null;
      result: string | null;
      nextFollowUpPlan: string | null;
      attachmentIds: number[] | null;
      metadata: Record<string, any> | null;
      plannedAt: string | null;
      location: string | null;
      participants: string | null;
      visitResultCode: string | null;
      summary: string | null;
      operatorUserId: number;
      operatorUserName: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/activities/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/attachments/ */
export async function getCrmV1Attachments(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1AttachmentsParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      entityType: string;
      entityId: number;
      attachmentId: number;
      creatorId: number | null;
      createdAt: string;
    }[];
    timestamp: string;
  }>("/api/crm/v1/attachments/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/crm/v1/attachments/ */
export async function postCrmV1Attachments(
  body: {
    customerId: number;
    entityType: "customer" | "activity";
    entityId: number;
    attachmentId: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      entityType: string;
      entityId: number;
      attachmentId: number;
      creatorId: number | null;
      createdAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/attachments/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/crm/v1/attachments/${param0} */
export async function deleteCrmV1AttachmentsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmV1AttachmentsIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/attachments/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 联系人列表 GET /api/crm/v1/contacts/ */
export async function crmContactsList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmContactsListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      name: string;
      gender: number;
      mobile: string | null;
      phone: string | null;
      email: string | null;
      department: string | null;
      position: string | null;
      isPrimary: number;
      roleCode: string | null;
      birthday: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/contacts/", {
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

/** 新建联系人 POST /api/crm/v1/contacts/ */
export async function crmContactsCreate(
  body: {
    customerId: number;
    name: string;
    gender?: number;
    mobile?: string;
    phone?: string;
    email?: string;
    department?: string;
    position?: string;
    isPrimary?: number;
    roleCode?: string;
    birthday?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      name: string;
      gender: number;
      mobile: string | null;
      phone: string | null;
      email: string | null;
      department: string | null;
      position: string | null;
      isPrimary: number;
      roleCode: string | null;
      birthday: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/contacts/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 联系人详情 GET /api/crm/v1/contacts/${param0} */
export async function crmContactsDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmContactsDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      name: string;
      gender: number;
      mobile: string | null;
      phone: string | null;
      email: string | null;
      department: string | null;
      position: string | null;
      isPrimary: number;
      roleCode: string | null;
      birthday: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/contacts/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除联系人 DELETE /api/crm/v1/contacts/${param0} */
export async function crmContactsDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmContactsDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/contacts/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新联系人 PATCH /api/crm/v1/contacts/${param0} */
export async function crmContactsUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmContactsUpdateParams,
  body: {
    name?: string;
    gender?: number;
    mobile?: string | null;
    phone?: string | null;
    email?: string | null;
    department?: string | null;
    position?: string | null;
    isPrimary?: number;
    roleCode?: string | null;
    birthday?: string | null;
    remark?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      name: string;
      gender: number;
      mobile: string | null;
      phone: string | null;
      email: string | null;
      department: string | null;
      position: string | null;
      isPrimary: number;
      roleCode: string | null;
      birthday: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/contacts/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/contracts/ */
export async function getCrmV1Contracts(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1ContractsParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      contractNo: string;
      name: string;
      customerId: number;
      opportunityId: number | null;
      quotationId: number | null;
      contactId: number | null;
      amountCents: number;
      status: "draft" | "performing" | "completed" | "terminated";
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      signedAt: string | null;
      effectiveAt: string | null;
      expiresAt: string | null;
      description: string | null;
      createdAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/contracts/", {
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

/** 此处后端没有提供注释 POST /api/crm/v1/contracts/ */
export async function postCrmV1Contracts(
  body: {
    name: string;
    customerId: number;
    opportunityId?: number | null;
    quotationId?: number | null;
    contactId?: number | null;
    amountCents: number;
    signedAt?: string | null;
    effectiveAt?: string | null;
    expiresAt?: string | null;
    status?: "draft" | "performing" | "completed" | "terminated";
    description?: string | null;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      contractNo: string;
      name: string;
      customerId: number;
      opportunityId: number | null;
      quotationId: number | null;
      contactId: number | null;
      amountCents: number;
      status: "draft" | "performing" | "completed" | "terminated";
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      signedAt: string | null;
      effectiveAt: string | null;
      expiresAt: string | null;
      description: string | null;
      createdAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/contracts/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/contracts/${param0} */
export async function getCrmV1ContractsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1ContractsIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      contractNo: string;
      name: string;
      customerId: number;
      opportunityId: number | null;
      quotationId: number | null;
      contactId: number | null;
      amountCents: number;
      status: "draft" | "performing" | "completed" | "terminated";
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      signedAt: string | null;
      effectiveAt: string | null;
      expiresAt: string | null;
      description: string | null;
      createdAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/contracts/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/crm/v1/contracts/${param0} */
export async function deleteCrmV1ContractsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmV1ContractsIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/contracts/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/crm/v1/contracts/${param0} */
export async function patchCrmV1ContractsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchCrmV1ContractsIdParams,
  body: {
    name?: string;
    opportunityId?: number | null;
    quotationId?: number | null;
    contactId?: number | null;
    signedAt?: string | null;
    effectiveAt?: string | null;
    expiresAt?: string | null;
    status?: "draft" | "performing" | "completed" | "terminated";
    description?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      contractNo: string;
      name: string;
      customerId: number;
      opportunityId: number | null;
      quotationId: number | null;
      contactId: number | null;
      amountCents: number;
      status: "draft" | "performing" | "completed" | "terminated";
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      signedAt: string | null;
      effectiveAt: string | null;
      expiresAt: string | null;
      description: string | null;
      createdAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/contracts/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户列表 GET /api/crm/v1/customers/ */
export async function crmCustomersList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      ownerUserName: string | null;
      primaryContactId: number | null;
      primaryContactName: string | null;
      primaryContactMobile: string | null;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/customers/", {
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

/** 新建客户 POST /api/crm/v1/customers/ */
export async function crmCustomersCreate(
  body: {
    name: string;
    type?: "enterprise" | "individual";
    sourceId?: number | null;
    level?: string;
    industry?: string;
    phone?: string;
    website?: string;
    province?: string;
    city?: string;
    address?: string;
    ownerUserId?: number | null;
    ownerDepartmentId?: number | null;
    tagIds?: number[];
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      customer: {
        id: number;
        code: string | null;
        name: string;
        type: string;
        statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
        relationshipStatus: "potential" | "following" | "lost";
        sourceId: number | null;
        level: string | null;
        industry: string | null;
        phone: string | null;
        website: string | null;
        province: string | null;
        city: string | null;
        address: string | null;
        ownerUserId: number | null;
        ownerDepartmentId: number | null;
        poolStatus: string;
        lastFollowUpAt: string | null;
        nextFollowUpAt: string | null;
        remark: string | null;
        creatorId: number | null;
        createdAt: string;
        updaterId: number | null;
        updatedAt: string;
      };
      duplicate: {
        existingCustomerId: number;
        existingCustomerName: string;
        ownerUserId: number | null;
        ownerUserName: string | null;
      } | null;
    };
    timestamp: string;
  }>("/api/crm/v1/customers/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 客户详情 GET /api/crm/v1/customers/${param0} */
export async function crmCustomersDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      tagIds: number[];
      ownerUserName: string | null;
      statusName: string | null;
      sourceName: string | null;
      primaryContactId: number | null;
      primaryContactName: string | null;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除客户 DELETE /api/crm/v1/customers/${param0} */
export async function crmCustomersDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新客户 PATCH /api/crm/v1/customers/${param0} */
export async function crmCustomersUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersUpdateParams,
  body: {
    name?: string;
    type?: "enterprise" | "individual";
    sourceId?: number | null;
    level?: string;
    industry?: string;
    phone?: string;
    website?: string;
    province?: string;
    city?: string;
    address?: string;
    ownerUserId?: number | null;
    ownerDepartmentId?: number | null;
    tagIds?: number[];
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户跟进记录 GET /api/crm/v1/customers/${param0}/activities */
export async function crmCustomerActivitiesList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomerActivitiesListParams,
  options?: { [key: string]: any }
) {
  const { customerId: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      total: number;
      items: {
        id: number;
        customerId: number | null;
        contactId: number | null;
        entityType: "customer" | "opportunity" | "contract" | null;
        entityId: number | null;
        entityRefType: string | null;
        category: "follow_up" | "system" | "business";
        type: string;
        content: string;
        occurredAt: string;
        nextFollowUpAt: string | null;
        result: string | null;
        nextFollowUpPlan: string | null;
        attachmentIds: number[] | null;
        metadata: Record<string, any> | null;
        plannedAt: string | null;
        location: string | null;
        participants: string | null;
        visitResultCode: string | null;
        summary: string | null;
        operatorUserId: number;
        operatorUserName: string | null;
        createdAt: string;
        updatedAt: string;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/activities`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 新建跟进记录 POST /api/crm/v1/customers/${param0}/activities */
export async function crmCustomerActivitiesCreate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomerActivitiesCreateParams,
  body: {
    contactId?: number | null;
    type: "phone" | "wechat" | "visit" | "email" | "meeting" | "other";
    content: string;
    occurredAt?: string;
    nextFollowUpAt?: string | null;
    result?:
      | "continue"
      | "interested"
      | "not_now"
      | "unreachable"
      | "invalid"
      | null;
    nextFollowUpPlan?: string | null;
    attachmentIds?: number[] | null;
    metadata?: Record<string, any> | null;
    plannedAt?: string | null;
    location?: string | null;
    participants?: string | null;
    visitResultCode?: string | null;
    summary?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { customerId: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number | null;
      contactId: number | null;
      entityType: "customer" | "opportunity" | "contract" | null;
      entityId: number | null;
      entityRefType: string | null;
      category: "follow_up" | "system" | "business";
      type: string;
      content: string;
      occurredAt: string;
      nextFollowUpAt: string | null;
      result: string | null;
      nextFollowUpPlan: string | null;
      attachmentIds: number[] | null;
      metadata: Record<string, any> | null;
      plannedAt: string | null;
      location: string | null;
      participants: string | null;
      visitResultCode: string | null;
      summary: string | null;
      operatorUserId: number;
      operatorUserName: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 认领公海客户 POST /api/crm/v1/customers/${param0}/claim */
export async function crmCustomersClaim(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersClaimParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/claim`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 客户下的联系人 GET /api/crm/v1/customers/${param0}/contacts */
export async function crmCustomerContactsList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomerContactsListParams,
  options?: { [key: string]: any }
) {
  const { customerId: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      name: string;
      gender: number;
      mobile: string | null;
      phone: string | null;
      email: string | null;
      department: string | null;
      position: string | null;
      isPrimary: number;
      roleCode: string | null;
      birthday: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    }[];
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/contacts`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 客户下新建联系人 POST /api/crm/v1/customers/${param0}/contacts */
export async function crmCustomerContactsCreate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomerContactsCreateParams,
  body: {
    name: string;
    gender?: number;
    mobile?: string;
    phone?: string;
    email?: string;
    department?: string;
    position?: string;
    isPrimary?: number;
    roleCode?: string;
    birthday?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  const { customerId: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      name: string;
      gender: number;
      mobile: string | null;
      phone: string | null;
      email: string | null;
      department: string | null;
      position: string | null;
      isPrimary: number;
      roleCode: string | null;
      birthday: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户协同人列表 GET /api/crm/v1/customers/${param0}/members */
export async function crmCustomerMembersList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomerMembersListParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      items: {
        id: number;
        customerId: number;
        userId: number;
        role: string;
        userName: string | null;
        createdAt: string;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/members`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 添加客户协同人 POST /api/crm/v1/customers/${param0}/members */
export async function crmCustomerMembersAdd(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomerMembersAddParams,
  body: {
    userId: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      items: {
        id: number;
        customerId: number;
        userId: number;
        role: string;
        userName: string | null;
        createdAt: string;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 移除客户协同人 DELETE /api/crm/v1/customers/${param0}/members/${param1} */
export async function crmCustomerMembersRemove(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomerMembersRemoveParams,
  options?: { [key: string]: any }
) {
  const { id: param0, userId: param1, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      items: {
        id: number;
        customerId: number;
        userId: number;
        role: string;
        userName: string | null;
        createdAt: string;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/members/${param1}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 永久删除客户（仅回收站内） DELETE /api/crm/v1/customers/${param0}/purge */
export async function crmCustomersPurge(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersPurgeParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/purge`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 变更客户关系状态 POST /api/crm/v1/customers/${param0}/relationship-status-transitions */
export async function crmCustomersTransitionRelationshipStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersTransitionRelationshipStatusParams,
  body: {
    target: "potential" | "following" | "lost";
    reasonCode?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/relationship-status-transitions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 释放客户到公海 POST /api/crm/v1/customers/${param0}/release */
export async function crmCustomersRelease(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersReleaseParams,
  body: {
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/release`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 从回收站恢复客户 POST /api/crm/v1/customers/${param0}/restore */
export async function crmCustomersRestore(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersRestoreParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/restore`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 转交客户 POST /api/crm/v1/customers/${param0}/transfer */
export async function crmCustomersTransfer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersTransferParams,
  body: {
    targetUserId: number;
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/transfer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户流转日志 GET /api/crm/v1/customers/${param0}/transfers */
export async function crmCustomersTransfers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersTransfersParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      type: string;
      fromUserId: number | null;
      toUserId: number | null;
      operatorUserId: number;
      reason: string | null;
      createdAt: string;
      fromUserName: string | null;
      toUserName: string | null;
      operatorUserName: string | null;
    }[];
    timestamp: string;
  }>(`/api/crm/v1/customers/${param0}/transfers`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 私域客户列表筛选能力及可见负责人 GET /api/crm/v1/customers/options */
export async function crmCustomersOptions(options?: { [key: string]: any }) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: { canFilterOwners: boolean; owners: { id: number; name: string }[] };
    timestamp: string;
  }>("/api/crm/v1/customers/options", {
    method: "GET",
    ...(options || {}),
  });
}

/** 客户回收站列表 GET /api/crm/v1/customers/trash */
export async function crmCustomersTrashList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCustomersTrashListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      ownerUserName: string | null;
      primaryContactId: number | null;
      primaryContactName: string | null;
      primaryContactMobile: string | null;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/customers/trash", {
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

/** CRM 工作台 GET /api/crm/v1/dashboard/ */
export async function crmDashboard(options?: { [key: string]: any }) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      counters: {
        myCustomers: number;
        pendingFollowUp: number;
        overdueFollowUp: number;
        todayNew: number;
        publicPool: number;
        weekFollowUps: number;
        monthNew: number;
      };
      pendingFollowUps: {
        id: number;
        name: string;
        ownerUserName: string | null;
        nextFollowUpAt: string | null;
        statusName: string | null;
      }[];
      recentActivities: {
        id: number;
        type: string;
        operatorUserName: string | null;
        customerId: number;
        customerName: string;
        occurredAt: string;
        summary: string;
      }[];
    };
    timestamp: string;
  }>("/api/crm/v1/dashboard/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 撤销无合同成交确认 POST /api/crm/v1/direct-closes/${param0}/revoke */
export async function crmDirectCloseRevoke(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmDirectCloseRevokeParams,
  body: {
    reason: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      directClose: {
        id: number;
        customerId: number;
        opportunityId: number;
        amountCents: number;
        closedAt: string;
        evidenceType:
          | "payment_proof"
          | "order_confirmation"
          | "verbal_confirmation"
          | "other";
        attachmentIds: number[] | null;
        remark: string | null;
        revokedAt: string | null;
        revokedReason: string | null;
      };
      statusCode: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/direct-closes/${param0}/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/opportunities/ */
export async function getCrmV1Opportunities(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1OpportunitiesParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      opportunityNo: string;
      name: string;
      customerId: number;
      customerName: string | null;
      primaryContactId: number | null;
      ownerId: number | null;
      ownerName: string | null;
      ownerDepartmentId: number | null;
      stage:
        | "needs_confirmation"
        | "solution"
        | "quotation"
        | "negotiation"
        | "won"
        | "lost";
      amountCents: number | null;
      expectedCloseDate: string | null;
      sourceId: number | null;
      requirement: string | null;
      competition: string | null;
      nextAction: string | null;
      nextFollowUpAt: string | null;
      lastFollowUpAt: string | null;
      remark: string | null;
      lostReason:
        | "price"
        | "competitor"
        | "budget_cancelled"
        | "demand_cancelled"
        | "postponed"
        | "unreachable"
        | "other"
        | null;
      products: { id: number; code: string; name: string }[];
      createdAt: string;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/opportunities/", {
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

/** 此处后端没有提供注释 POST /api/crm/v1/opportunities/ */
export async function postCrmV1Opportunities(
  body: {
    name: string;
    customerId: number;
    primaryContactId?: number | null;
    ownerId: number;
    stage?: "needs_confirmation" | "solution" | "quotation" | "negotiation";
    amountCents?: number | null;
    expectedCloseDate?: string | null;
    sourceId?: number | null;
    productIds?: number[];
    requirement: string;
    competition?: string | null;
    remark?: string;
    nextAction?: string;
    nextFollowUpAt?: string | null;
    creationKey?: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      opportunityNo: string;
      name: string;
      customerId: number;
      customerName: string | null;
      primaryContactId: number | null;
      ownerId: number | null;
      ownerName: string | null;
      ownerDepartmentId: number | null;
      stage:
        | "needs_confirmation"
        | "solution"
        | "quotation"
        | "negotiation"
        | "won"
        | "lost";
      amountCents: number | null;
      expectedCloseDate: string | null;
      sourceId: number | null;
      requirement: string | null;
      competition: string | null;
      nextAction: string | null;
      nextFollowUpAt: string | null;
      lastFollowUpAt: string | null;
      remark: string | null;
      lostReason:
        | "price"
        | "competitor"
        | "budget_cancelled"
        | "demand_cancelled"
        | "postponed"
        | "unreachable"
        | "other"
        | null;
      products: { id: number; code: string; name: string }[];
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/opportunities/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/opportunities/${param0} */
export async function getCrmV1OpportunitiesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1OpportunitiesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      opportunityNo: string;
      name: string;
      customerId: number;
      customerName: string | null;
      primaryContactId: number | null;
      ownerId: number | null;
      ownerName: string | null;
      ownerDepartmentId: number | null;
      stage:
        | "needs_confirmation"
        | "solution"
        | "quotation"
        | "negotiation"
        | "won"
        | "lost";
      amountCents: number | null;
      expectedCloseDate: string | null;
      sourceId: number | null;
      requirement: string | null;
      competition: string | null;
      nextAction: string | null;
      nextFollowUpAt: string | null;
      lastFollowUpAt: string | null;
      remark: string | null;
      lostReason:
        | "price"
        | "competitor"
        | "budget_cancelled"
        | "demand_cancelled"
        | "postponed"
        | "unreachable"
        | "other"
        | null;
      products: { id: number; code: string; name: string }[];
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/opportunities/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/crm/v1/opportunities/${param0} */
export async function deleteCrmV1OpportunitiesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmV1OpportunitiesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: { id: number };
    timestamp: string;
  }>(`/api/crm/v1/opportunities/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/crm/v1/opportunities/${param0} */
export async function patchCrmV1OpportunitiesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchCrmV1OpportunitiesIdParams,
  body: {
    name?: string;
    primaryContactId?: number | null;
    ownerId?: number;
    amountCents?: number | null;
    expectedCloseDate?: string | null;
    sourceId?: number | null;
    productIds?: number[];
    requirement?: string | null;
    competition?: string | null;
    nextAction?: string | null;
    nextFollowUpAt?: string | null;
    remark?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      opportunityNo: string;
      name: string;
      customerId: number;
      customerName: string | null;
      primaryContactId: number | null;
      ownerId: number | null;
      ownerName: string | null;
      ownerDepartmentId: number | null;
      stage:
        | "needs_confirmation"
        | "solution"
        | "quotation"
        | "negotiation"
        | "won"
        | "lost";
      amountCents: number | null;
      expectedCloseDate: string | null;
      sourceId: number | null;
      requirement: string | null;
      competition: string | null;
      nextAction: string | null;
      nextFollowUpAt: string | null;
      lastFollowUpAt: string | null;
      remark: string | null;
      lostReason:
        | "price"
        | "competitor"
        | "budget_cancelled"
        | "demand_cancelled"
        | "postponed"
        | "unreachable"
        | "other"
        | null;
      products: { id: number; code: string; name: string }[];
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/opportunities/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/crm/v1/opportunities/${param0}/advance */
export async function postCrmV1OpportunitiesIdAdvance(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postCrmV1OpportunitiesIdAdvanceParams,
  body: {
    toStage: "solution" | "quotation" | "negotiation";
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      opportunityNo: string;
      name: string;
      customerId: number;
      customerName: string | null;
      primaryContactId: number | null;
      ownerId: number | null;
      ownerName: string | null;
      ownerDepartmentId: number | null;
      stage:
        | "needs_confirmation"
        | "solution"
        | "quotation"
        | "negotiation"
        | "won"
        | "lost";
      amountCents: number | null;
      expectedCloseDate: string | null;
      sourceId: number | null;
      requirement: string | null;
      competition: string | null;
      nextAction: string | null;
      nextFollowUpAt: string | null;
      lastFollowUpAt: string | null;
      remark: string | null;
      lostReason:
        | "price"
        | "competitor"
        | "budget_cancelled"
        | "demand_cancelled"
        | "postponed"
        | "unreachable"
        | "other"
        | null;
      products: { id: number; code: string; name: string }[];
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/opportunities/${param0}/advance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/crm/v1/opportunities/${param0}/lost */
export async function postCrmV1OpportunitiesIdLost(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postCrmV1OpportunitiesIdLostParams,
  body: {
    lostReason:
      | "price"
      | "competitor"
      | "budget_cancelled"
      | "demand_cancelled"
      | "postponed"
      | "unreachable"
      | "other";
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      opportunityNo: string;
      name: string;
      customerId: number;
      customerName: string | null;
      primaryContactId: number | null;
      ownerId: number | null;
      ownerName: string | null;
      ownerDepartmentId: number | null;
      stage:
        | "needs_confirmation"
        | "solution"
        | "quotation"
        | "negotiation"
        | "won"
        | "lost";
      amountCents: number | null;
      expectedCloseDate: string | null;
      sourceId: number | null;
      requirement: string | null;
      competition: string | null;
      nextAction: string | null;
      nextFollowUpAt: string | null;
      lastFollowUpAt: string | null;
      remark: string | null;
      lostReason:
        | "price"
        | "competitor"
        | "budget_cancelled"
        | "demand_cancelled"
        | "postponed"
        | "unreachable"
        | "other"
        | null;
      products: { id: number; code: string; name: string }[];
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/opportunities/${param0}/lost`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/crm/v1/opportunities/${param0}/won */
export async function postCrmV1OpportunitiesIdWon(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postCrmV1OpportunitiesIdWonParams,
  body: {
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      opportunityNo: string;
      name: string;
      customerId: number;
      customerName: string | null;
      primaryContactId: number | null;
      ownerId: number | null;
      ownerName: string | null;
      ownerDepartmentId: number | null;
      stage:
        | "needs_confirmation"
        | "solution"
        | "quotation"
        | "negotiation"
        | "won"
        | "lost";
      amountCents: number | null;
      expectedCloseDate: string | null;
      sourceId: number | null;
      requirement: string | null;
      competition: string | null;
      nextAction: string | null;
      nextFollowUpAt: string | null;
      lastFollowUpAt: string | null;
      remark: string | null;
      lostReason:
        | "price"
        | "competitor"
        | "budget_cancelled"
        | "demand_cancelled"
        | "postponed"
        | "unreachable"
        | "other"
        | null;
      products: { id: number; code: string; name: string }[];
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/opportunities/${param0}/won`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/opportunities/duplicate-check */
export async function getCrmV1OpportunitiesDuplicateCheck(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1OpportunitiesDuplicateCheckParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      opportunityNo: string;
      name: string;
      customerId: number;
      customerName: string | null;
      primaryContactId: number | null;
      ownerId: number | null;
      ownerName: string | null;
      ownerDepartmentId: number | null;
      stage:
        | "needs_confirmation"
        | "solution"
        | "quotation"
        | "negotiation"
        | "won"
        | "lost";
      amountCents: number | null;
      expectedCloseDate: string | null;
      sourceId: number | null;
      requirement: string | null;
      competition: string | null;
      nextAction: string | null;
      nextFollowUpAt: string | null;
      lastFollowUpAt: string | null;
      remark: string | null;
      lostReason:
        | "price"
        | "competitor"
        | "budget_cancelled"
        | "demand_cancelled"
        | "postponed"
        | "unreachable"
        | "other"
        | null;
      products: { id: number; code: string; name: string }[];
      createdAt: string;
      updatedAt: string;
    }[];
    timestamp: string;
  }>("/api/crm/v1/opportunities/duplicate-check", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/payments/ */
export async function getCrmV1Payments(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1PaymentsParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: ({
      id: number;
      paymentNo: string;
      contractId: number;
      customerId: number;
      amountCents: number;
      paidAt: string;
      methodCode:
        | "bank_transfer"
        | "alipay"
        | "wechat"
        | "cash"
        | "check"
        | "other";
      transactionNo: string | null;
      status: "confirmed" | "pending" | "voided";
      remark: string | null;
      creatorId: number | null;
      creatorName: string | null;
      createdAt: string;
      updatedAt: string;
    } & { contractNo: string; contractName: string; customerName: string })[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/payments/", {
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

/** 此处后端没有提供注释 DELETE /api/crm/v1/payments/${param0} */
export async function deleteCrmV1PaymentsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmV1PaymentsIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/payments/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/crm/v1/payments/${param0} */
export async function patchCrmV1PaymentsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchCrmV1PaymentsIdParams,
  body: {
    amountCents?: number;
    paidAt?: string;
    methodCode?:
      | "bank_transfer"
      | "alipay"
      | "wechat"
      | "cash"
      | "check"
      | "other";
    transactionNo?: string;
    remark?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      paymentNo: string;
      contractId: number;
      customerId: number;
      amountCents: number;
      paidAt: string;
      methodCode:
        | "bank_transfer"
        | "alipay"
        | "wechat"
        | "cash"
        | "check"
        | "other";
      transactionNo: string | null;
      status: "confirmed" | "pending" | "voided";
      remark: string | null;
      creatorId: number | null;
      creatorName: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/payments/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/payments/contracts/${param0} */
export async function getCrmV1PaymentsContractsContractId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1PaymentsContractsContractIdParams,
  options?: { [key: string]: any }
) {
  const { contractId: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/payments/contracts/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/crm/v1/payments/contracts/${param0} */
export async function postCrmV1PaymentsContractsContractId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postCrmV1PaymentsContractsContractIdParams,
  body: {
    amountCents: number;
    paidAt: string;
    methodCode?:
      | "bank_transfer"
      | "alipay"
      | "wechat"
      | "cash"
      | "check"
      | "other";
    transactionNo?: string;
    remark?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { contractId: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      paymentNo: string;
      contractId: number;
      customerId: number;
      amountCents: number;
      paidAt: string;
      methodCode:
        | "bank_transfer"
        | "alipay"
        | "wechat"
        | "cash"
        | "check"
        | "other";
      transactionNo: string | null;
      status: "confirmed" | "pending" | "voided";
      remark: string | null;
      creatorId: number | null;
      creatorName: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/payments/contracts/${param0}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户公海 GET /api/crm/v1/pool/ */
export async function crmPoolList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmPoolListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string | null;
      name: string;
      type: string;
      statusCode: "potential" | "following" | "opportunity" | "won" | "lost";
      relationshipStatus: "potential" | "following" | "lost";
      sourceId: number | null;
      level: string | null;
      industry: string | null;
      phone: string | null;
      website: string | null;
      province: string | null;
      city: string | null;
      address: string | null;
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      poolStatus: string;
      lastFollowUpAt: string | null;
      nextFollowUpAt: string | null;
      remark: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      ownerUserName: string | null;
      primaryContactId: number | null;
      primaryContactName: string | null;
      primaryContactMobile: string | null;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/pool/", {
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

/** 产品列表 GET /api/crm/v1/products/ */
export async function crmProductsList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductsListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      categoryCode: string | null;
      categoryName: string | null;
      unitCode: string | null;
      unitName: string | null;
      standardPriceCents: number;
      taxRateBp: number;
      enabled: number;
      description: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/products/", {
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

/** 新建产品 POST /api/crm/v1/products/ */
export async function crmProductsCreate(
  body: {
    code: string;
    name: string;
    categoryCode?: string | null;
    unitCode?: string | null;
    standardPriceCents?: number;
    taxRateBp?: number;
    enabled?: number;
    description?: string | null;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      categoryCode: string | null;
      categoryName: string | null;
      unitCode: string | null;
      unitName: string | null;
      standardPriceCents: number;
      taxRateBp: number;
      enabled: number;
      description: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/products/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 产品详情 GET /api/crm/v1/products/${param0} */
export async function crmProductsDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductsDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      categoryCode: string | null;
      categoryName: string | null;
      unitCode: string | null;
      unitName: string | null;
      standardPriceCents: number;
      taxRateBp: number;
      enabled: number;
      description: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/products/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 软删除产品 DELETE /api/crm/v1/products/${param0} */
export async function crmProductsDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductsDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/products/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新产品 PATCH /api/crm/v1/products/${param0} */
export async function crmProductsUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductsUpdateParams,
  body: {
    name?: string;
    categoryCode?: string | null;
    unitCode?: string | null;
    standardPriceCents?: number;
    taxRateBp?: number;
    enabled?: number;
    description?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      categoryCode: string | null;
      categoryName: string | null;
      unitCode: string | null;
      unitName: string | null;
      standardPriceCents: number;
      taxRateBp: number;
      enabled: number;
      description: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/products/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 停用产品 POST /api/crm/v1/products/${param0}/disable */
export async function crmProductsDisable(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductsDisableParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      categoryCode: string | null;
      categoryName: string | null;
      unitCode: string | null;
      unitName: string | null;
      standardPriceCents: number;
      taxRateBp: number;
      enabled: number;
      description: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/products/${param0}/disable`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 启用产品 POST /api/crm/v1/products/${param0}/enable */
export async function crmProductsEnable(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductsEnableParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      categoryCode: string | null;
      categoryName: string | null;
      unitCode: string | null;
      unitName: string | null;
      standardPriceCents: number;
      taxRateBp: number;
      enabled: number;
      description: string | null;
      creatorId: number | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/products/${param0}/enable`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 产品分类列表 GET /api/crm/v1/products/categories */
export async function crmProductCategoriesList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductCategoriesListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      parentCode: string | null;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/products/categories", {
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

/** 新建产品分类 POST /api/crm/v1/products/categories */
export async function crmProductCategoriesCreate(
  body: {
    code: string;
    name: string;
    parentCode?: string | null;
    sort?: number;
    enabled?: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      parentCode: string | null;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/products/categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 软删除产品分类 DELETE /api/crm/v1/products/categories/${param0} */
export async function crmProductCategoriesDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductCategoriesDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/products/categories/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新产品分类 PATCH /api/crm/v1/products/categories/${param0} */
export async function crmProductCategoriesUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductCategoriesUpdateParams,
  body: {
    name?: string;
    parentCode?: string | null;
    sort?: number;
    enabled?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      parentCode: string | null;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/products/categories/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 产品分类下拉（仅启用） GET /api/crm/v1/products/categories/options */
export async function crmProductCategoriesOptions(options?: {
  [key: string]: any;
}) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      total: number;
      page: number;
      pageSize: number;
      items: {
        id: number;
        code: string;
        name: string;
        parentCode: string | null;
        sort: number;
        enabled: number;
        createdAt: string;
        updatedAt: string;
      }[];
    };
    timestamp: string;
  }>("/api/crm/v1/products/categories/options", {
    method: "GET",
    ...(options || {}),
  });
}

/** 计量单位列表 GET /api/crm/v1/products/units */
export async function crmProductUnitsList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductUnitsListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/products/units", {
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

/** 新建计量单位 POST /api/crm/v1/products/units */
export async function crmProductUnitsCreate(
  body: {
    code: string;
    name: string;
    sort?: number;
    enabled?: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/products/units", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 软删除计量单位 DELETE /api/crm/v1/products/units/${param0} */
export async function crmProductUnitsDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductUnitsDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/products/units/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新计量单位 PATCH /api/crm/v1/products/units/${param0} */
export async function crmProductUnitsUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmProductUnitsUpdateParams,
  body: {
    name?: string;
    sort?: number;
    enabled?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      code: string;
      name: string;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/products/units/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 计量单位下拉（仅启用） GET /api/crm/v1/products/units/options */
export async function crmProductUnitsOptions(options?: { [key: string]: any }) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      total: number;
      page: number;
      pageSize: number;
      items: {
        id: number;
        code: string;
        name: string;
        sort: number;
        enabled: number;
        createdAt: string;
        updatedAt: string;
      }[];
    };
    timestamp: string;
  }>("/api/crm/v1/products/units/options", {
    method: "GET",
    ...(options || {}),
  });
}

/** 公开报价查看 GET /api/crm/v1/public/quotes/${param0} */
export async function crmPublicQuoteGet(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmPublicQuoteGetParams,
  options?: { [key: string]: any }
) {
  const { token: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      state: "ok" | "expired" | "revoked" | "invalid";
      quote: {
        companyName: string;
        quoteTitle: string;
        quoteNumber: string;
        quoteDate: string | null;
        validUntil: string | null;
        customerName: string;
        contactDisplayName: string | null;
        items: {
          name: string;
          description: string | null;
          quantity: number;
          unit: string | null;
          unitPriceCents: number;
          amountCents: number;
        }[];
        subtotalCents: number;
        publicDiscountDescription: string | null;
        discountAmountCents: number;
        totalAmountCents: number;
        remark: string | null;
        salesContactName: string | null;
        salesContactPhone: string | null;
        version: number;
      } | null;
    };
    timestamp: string;
  }>(`/api/crm/v1/public/quotes/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 报价单列表 GET /api/crm/v1/quotations/ */
export async function crmQuotationsList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      seriesId: string;
      seriesNo: string;
      title: string;
      customerId: number;
      customerName: string | null;
      opportunityId: number | null;
      opportunityName: string | null;
      opportunityNo: string | null;
      currentQuoteId: number;
      currentVersion?: number;
      versionCount?: number;
      currentStatus:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      currentAmount: number;
      quoteDate: string | null;
      validUntil: string | null;
      customerViewStatus: "viewed" | "unviewed";
      lastViewedAt: string | null;
      viewCount: number;
      ownerUserId: number;
      ownerUserName: string | null;
      hasActiveShare: boolean;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/quotations/", {
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

/** 新建报价单（draft） POST /api/crm/v1/quotations/ */
export async function crmQuotationsCreate(
  body: {
    customerId: number;
    opportunityId: number;
    contactId: number;
    quoteDate: string;
    validUntil?: string;
    name?: string;
    publicDiscountDescription?: string;
    internalDiscountReason?: string;
    discountAmountCents?: number;
    remark?: string;
    items: {
      productId?: number | null;
      productNameSnapshot: string;
      description?: string;
      unitSnapshot?: string;
      quantityCents: number;
      unitPriceCents: number;
      discountBp?: number;
      taxRateBp?: number;
    }[];
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>("/api/crm/v1/quotations/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 报价单详情 GET /api/crm/v1/quotations/${param0} */
export async function crmQuotationsGet(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsGetParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 软删除报价单（仅 draft 阶段生效） DELETE /api/crm/v1/quotations/${param0} */
export async function crmQuotationsDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: { id: number };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 编辑报价单（仅 draft 阶段生效） PATCH /api/crm/v1/quotations/${param0} */
export async function crmQuotationsUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsUpdateParams,
  body: {
    customerId?: number;
    opportunityId?: number;
    contactId?: number;
    quoteDate?: string;
    validUntil?: string;
    name?: string;
    publicDiscountDescription?: string;
    internalDiscountReason?: string;
    discountAmountCents?: number;
    remark?: string;
    items?: {
      productId?: number | null;
      productNameSnapshot: string;
      description?: string;
      unitSnapshot?: string;
      quantityCents: number;
      unitPriceCents: number;
      discountBp?: number;
      taxRateBp?: number;
    }[];
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 销售确认报价（sent → accepted） POST /api/crm/v1/quotations/${param0}/accept */
export async function crmQuotationsAccept(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsAcceptParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/accept`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 提交已确认报价的合同表单 POST /api/crm/v1/quotations/${param0}/contract */
export async function crmQuotationsCreateContract(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsCreateContractParams,
  body: {
    name: string;
    customerId: number;
    opportunityId?: number | null;
    quotationId?: number | null;
    contactId?: number | null;
    amountCents: number;
    signedAt?: string | null;
    effectiveAt?: string | null;
    expiresAt?: string | null;
    status?: "draft" | "performing" | "completed" | "terminated";
    description?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      contractNo: string;
      name: string;
      customerId: number;
      opportunityId: number | null;
      quotationId: number | null;
      contactId: number | null;
      amountCents: number;
      status: "draft" | "performing" | "completed" | "terminated";
      ownerUserId: number | null;
      ownerDepartmentId: number | null;
      signedAt: string | null;
      effectiveAt: string | null;
      expiresAt: string | null;
      description: string | null;
      createdAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/contract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 内部预览报价（不计入客户查看） GET /api/crm/v1/quotations/${param0}/preview */
export async function crmQuotationsPreview(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsPreviewParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      companyName: string;
      quoteTitle: string;
      quoteNumber: string;
      quoteDate: string | null;
      validUntil: string | null;
      customerName: string;
      contactDisplayName: string | null;
      items: {
        name: string;
        description: string | null;
        quantity: number;
        unit: string | null;
        unitPriceCents: number;
        amountCents: number;
      }[];
      subtotalCents: number;
      publicDiscountDescription: string | null;
      discountAmountCents: number;
      totalAmountCents: number;
      remark: string | null;
      salesContactName: string | null;
      salesContactPhone: string | null;
      version: number;
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/preview`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 拒绝报价单（sent → rejected） POST /api/crm/v1/quotations/${param0}/reject */
export async function crmQuotationsReject(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsRejectParams,
  body: {
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 基于报价创建新版本草稿 POST /api/crm/v1/quotations/${param0}/revise */
export async function crmQuotationsRevise(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsReviseParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/revise`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 撤销报价确认（未生成合同） POST /api/crm/v1/quotations/${param0}/revoke-confirmation */
export async function crmQuotationsRevokeConfirmation(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsRevokeConfirmationParams,
  body: {
    reason: "mistake" | "customer_unconfirmed" | "other";
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/revoke-confirmation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 发送报价单（draft → sent） POST /api/crm/v1/quotations/${param0}/send */
export async function crmQuotationsSend(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsSendParams,
  body: {
    shareId: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 生成报价公开分享链接 POST /api/crm/v1/quotations/${param0}/shares */
export async function crmQuotationsCreateShare(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsCreateShareParams,
  body: {
    replaceShareId?: number;
    durationDays?: 3 | 7 | 14 | 30;
    followQuoteValidUntil?: boolean;
    customDate?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: { shareId: number; url: string; expiresAt: string };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/shares`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 停用报价公开分享链接 POST /api/crm/v1/quotations/${param0}/shares/${param1}/revoke */
export async function crmQuotationsRevokeShare(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsRevokeShareParams,
  options?: { [key: string]: any }
) {
  const { id: param0, shareId: param1, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: { id: number };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/shares/${param1}/revoke`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 报价单状态变更审计 GET /api/crm/v1/quotations/${param0}/status-logs */
export async function crmQuotationsStatusLogs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsStatusLogsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      total: number;
      items: {
        id: number;
        quotationId: number;
        fromStatus:
          | "draft"
          | "sent"
          | "accepted"
          | "rejected"
          | "voided"
          | "superseded";
        toStatus:
          | "draft"
          | "sent"
          | "accepted"
          | "rejected"
          | "voided"
          | "superseded";
        operatorUserId: number;
        operatorUserName: string | null;
        reason: string | null;
        createdAt: string;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/status-logs`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 作废报价单（draft/sent → voided） POST /api/crm/v1/quotations/${param0}/void */
export async function crmQuotationsVoid(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsVoidParams,
  body: {
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      quotationNo: string;
      seriesId: string;
      seriesNo: string;
      seriesTitle: string;
      currentVersion: number;
      versionCount: number;
      name: string;
      version: number;
      rootQuoteId: number | null;
      sourceQuoteId: number | null;
      customerId: number;
      opportunityId: number | null;
      contactId: number | null;
      opportunityName: string | null;
      contactName: string | null;
      quoteDate: string | null;
      ownerUserId: number;
      ownerUserName: string | null;
      ownerDepartmentId: number | null;
      customerName: string | null;
      status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      validUntil: string | null;
      netCents: number;
      taxCents: number;
      totalCents: number;
      discountAmountCents: number;
      remark: string | null;
      creatorId: number | null;
      publicDiscountDescription: string | null;
      internalDiscountReason: string | null;
      createdAt: string;
      updaterId: number | null;
      updatedAt: string;
      sentAt: string | null;
      acceptedAt: string | null;
      acceptedBy: number | null;
      contractId: number | null;
      closedAt: string | null;
      shareFirstViewedAt: string | null;
      shareViewCount: number;
      hasShare: boolean;
      share: {
        id: number;
        url?: string;
        status: "active" | "revoked";
        expiresAt: string;
        sentAt: string | null;
        firstViewedAt: string | null;
        lastViewedAt: string | null;
        viewCount: number;
      } | null;
      items: {
        id: number;
        quotationId: number;
        productId: number | null;
        productNameSnapshot: string;
        description: string | null;
        unitSnapshot: string | null;
        quantityCents: number;
        unitPriceCents: number;
        discountBp: number;
        taxRateBp: number;
        lineAmountCents: number;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
      versions: {
        id: number;
        quotationNo: string;
        version: number;
        status: string;
        totalCents: number;
        quoteDate: string | null;
        createdAt: string;
        shareFirstViewedAt?: string | null;
        shareViewCount?: number;
        hasShare?: boolean;
      }[];
    };
    timestamp: string;
  }>(`/api/crm/v1/quotations/${param0}/void`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 查询同商机同名进行中报价系列 GET /api/crm/v1/quotations/duplicates */
export async function crmQuotationsDuplicates(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmQuotationsDuplicatesParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      seriesId: string;
      seriesNo: string;
      title: string;
      customerId: number;
      customerName: string | null;
      opportunityId: number | null;
      opportunityName: string | null;
      opportunityNo: string | null;
      currentQuoteId: number;
      currentVersion?: number;
      versionCount?: number;
      currentStatus:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "voided"
        | "superseded";
      currentAmount: number;
      quoteDate: string | null;
      validUntil: string | null;
      customerViewStatus: "viewed" | "unviewed";
      lastViewedAt: string | null;
      viewCount: number;
      ownerUserId: number;
      ownerUserName: string | null;
      hasActiveShare: boolean;
    }[];
  }>("/api/crm/v1/quotations/duplicates", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** CRM 客户来源列表 GET /api/crm/v1/settings/sources */
export async function crmSettingsSourcesList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmSettingsSourcesListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      name: string;
      code: string | null;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/settings/sources", {
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

/** 新建 CRM 客户来源 POST /api/crm/v1/settings/sources */
export async function crmSettingsSourcesCreate(
  body: {
    name: string;
    code?: string;
    sort?: number;
    enabled?: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      name: string;
      code: string | null;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/settings/sources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 删除 CRM 客户来源 DELETE /api/crm/v1/settings/sources/${param0} */
export async function crmSettingsSourcesDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmSettingsSourcesDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/settings/sources/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新 CRM 客户来源 PATCH /api/crm/v1/settings/sources/${param0} */
export async function crmSettingsSourcesUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmSettingsSourcesUpdateParams,
  body: {
    name?: string;
    sort?: number;
    enabled?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      name: string;
      code: string | null;
      sort: number;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/settings/sources/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** CRM 标签列表 GET /api/crm/v1/settings/tags */
export async function crmSettingsTagsList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmSettingsTagsListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      name: string;
      color: string | null;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/settings/tags", {
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

/** 新建 CRM 标签 POST /api/crm/v1/settings/tags */
export async function crmSettingsTagsCreate(
  body: {
    name: string;
    color?: string;
    enabled?: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      name: string;
      color: string | null;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/settings/tags", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 删除 CRM 标签 DELETE /api/crm/v1/settings/tags/${param0} */
export async function crmSettingsTagsDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmSettingsTagsDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/settings/tags/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新 CRM 标签 PATCH /api/crm/v1/settings/tags/${param0} */
export async function crmSettingsTagsUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmSettingsTagsUpdateParams,
  body: {
    name?: string;
    color?: string | null;
    enabled?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      name: string;
      color: string | null;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/settings/tags/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/tasks/ */
export async function getCrmV1Tasks(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1TasksParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      title: string;
      status: "todo" | "in_progress" | "completed" | "cancelled";
      priority: "normal" | "high" | "urgent";
      assigneeUserId: number | null;
      assigneeName: string | null;
      dueAt: string | null;
      completedAt: string | null;
      description: string | null;
      creatorId: number | null;
      creatorName: string | null;
      createdAt: string;
      updatedAt: string;
    }[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
  }>("/api/crm/v1/tasks/", {
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

/** 此处后端没有提供注释 POST /api/crm/v1/tasks/ */
export async function postCrmV1Tasks(
  body: {
    customerId: number;
    title: string;
    status?: "todo" | "in_progress" | "completed" | "cancelled";
    priority?: "normal" | "high" | "urgent";
    assigneeUserId?: number | null;
    dueAt?: string | null;
    description?: string | null;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      title: string;
      status: "todo" | "in_progress" | "completed" | "cancelled";
      priority: "normal" | "high" | "urgent";
      assigneeUserId: number | null;
      assigneeName: string | null;
      dueAt: string | null;
      completedAt: string | null;
      description: string | null;
      creatorId: number | null;
      creatorName: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/crm/v1/tasks/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/crm/v1/tasks/${param0} */
export async function getCrmV1TasksId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmV1TasksIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      title: string;
      status: "todo" | "in_progress" | "completed" | "cancelled";
      priority: "normal" | "high" | "urgent";
      assigneeUserId: number | null;
      assigneeName: string | null;
      dueAt: string | null;
      completedAt: string | null;
      description: string | null;
      creatorId: number | null;
      creatorName: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/tasks/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/crm/v1/tasks/${param0} */
export async function deleteCrmV1TasksId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmV1TasksIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: null;
    timestamp: string;
  }>(`/api/crm/v1/tasks/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/crm/v1/tasks/${param0} */
export async function patchCrmV1TasksId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.patchCrmV1TasksIdParams,
  body: {
    title?: string;
    status?: "todo" | "in_progress" | "completed" | "cancelled";
    priority?: "normal" | "high" | "urgent";
    assigneeUserId?: number | null;
    dueAt?: string | null;
    description?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      id: number;
      customerId: number;
      title: string;
      status: "todo" | "in_progress" | "completed" | "cancelled";
      priority: "normal" | "high" | "urgent";
      assigneeUserId: number | null;
      assigneeName: string | null;
      dueAt: string | null;
      completedAt: string | null;
      description: string | null;
      creatorId: number | null;
      creatorName: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/crm/v1/tasks/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 拜访独立列表（按 planned_at 排序） GET /api/crm/v1/visits/ */
export async function crmVisitsList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmVisitsListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: true;
    code: 10000;
    message: string;
    data: {
      total: number;
      items: {
        id: number;
        customerId: number | null;
        contactId: number | null;
        entityType: "customer" | "opportunity" | "contract" | null;
        entityId: number | null;
        entityRefType: string | null;
        category: "follow_up" | "system" | "business";
        type: string;
        content: string;
        occurredAt: string;
        nextFollowUpAt: string | null;
        result: string | null;
        nextFollowUpPlan: string | null;
        attachmentIds: number[] | null;
        metadata: Record<string, any> | null;
        plannedAt: string | null;
        location: string | null;
        participants: string | null;
        visitResultCode: string | null;
        summary: string | null;
        operatorUserId: number;
        operatorUserName: string | null;
        createdAt: string;
        updatedAt: string;
      }[];
    };
    timestamp: string;
  }>("/api/crm/v1/visits/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
