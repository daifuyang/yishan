// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** AI 消息流 POST /api/ai/v1/chat */
export async function aiChat(
  body: {
    id: string;
    messages: any[];
    trigger: "submit-message" | "regenerate-message";
    messageId?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/ai/v1/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** AI 会话列表 GET /api/ai/v1/conversations */
export async function aiConversationsList(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      items: {
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
      }[];
    };
  }>("/api/ai/v1/conversations", {
    method: "GET",
    ...(options || {}),
  });
}

/** 创建 AI 会话 POST /api/ai/v1/conversations */
export async function aiConversationsCreate(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
    } & {
      messages: {
        id: string;
        role: "user" | "assistant";
        parts: Record<string, any>[];
        metadata?: {
          status?: "complete" | "aborted" | "error";
          tokenUsage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
          };
          metrics: {
            durationMs: number;
            toolCalls: number;
            modelCalls: number;
          };
        };
      }[];
    };
  }>("/api/ai/v1/conversations", {
    method: "POST",
    ...(options || {}),
  });
}

/** AI 会话详情 GET /api/ai/v1/conversations/${param0} */
export async function aiConversationsDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiConversationsDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
    } & {
      messages: {
        id: string;
        role: "user" | "assistant";
        parts: Record<string, any>[];
        metadata?: {
          status?: "complete" | "aborted" | "error";
          tokenUsage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
          };
          metrics: {
            durationMs: number;
            toolCalls: number;
            modelCalls: number;
          };
        };
      }[];
    };
  }>(`/api/ai/v1/conversations/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除 AI 会话 DELETE /api/ai/v1/conversations/${param0} */
export async function aiConversationsDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiConversationsDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: null;
  }>(`/api/ai/v1/conversations/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 重命名 AI 会话 PATCH /api/ai/v1/conversations/${param0} */
export async function aiConversationsRename(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiConversationsRenameParams,
  body: {
    title: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
    } & {
      messages: {
        id: string;
        role: "user" | "assistant";
        parts: Record<string, any>[];
        metadata?: {
          status?: "complete" | "aborted" | "error";
          tokenUsage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
          };
          metrics: {
            durationMs: number;
            toolCalls: number;
            modelCalls: number;
          };
        };
      }[];
    };
  }>(`/api/ai/v1/conversations/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 会话草稿列表 GET /api/ai/v1/conversations/${param0}/drafts */
export async function aiActionDraftList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiActionDraftListParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      items: {
        draftId: string;
        ownerId: number;
        conversationId: string;
        module: "system";
        action: "user.create" | "department.create";
        schemaVersion: number;
        formData: Record<string, any>;
        missingFields: {
          name: string;
          label: string;
          required: boolean;
          sensitive: boolean;
          mustCompleteInForm: boolean;
        }[];
        validationErrors: {
          field: string;
          label: string;
          code: string;
          message: string;
        }[];
        draftVersion: number;
        status:
          | "collecting"
          | "ready"
          | "previewing"
          | "submitting"
          | "completed"
          | "failed"
          | "cancelled"
          | "expired";
        resultRef: { targetType: string; targetId: string } | null;
        failureReason: string | null;
        createdAt: string;
        updatedAt: string;
        expiresAt: string;
      }[];
    };
  }>(`/api/ai/v1/conversations/${param0}/drafts`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 创建表单草稿 POST /api/ai/v1/conversations/${param0}/drafts */
export async function aiActionDraftCreate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiActionDraftCreateParams,
  body: {
    module: "system";
    action: "user.create" | "department.create";
    formData: Record<string, any>;
    schemaVersion?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      draftId: string;
      ownerId: number;
      conversationId: string;
      module: "system";
      action: "user.create" | "department.create";
      schemaVersion: number;
      formData: Record<string, any>;
      missingFields: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        mustCompleteInForm: boolean;
      }[];
      validationErrors: {
        field: string;
        label: string;
        code: string;
        message: string;
      }[];
      draftVersion: number;
      status:
        | "collecting"
        | "ready"
        | "previewing"
        | "submitting"
        | "completed"
        | "failed"
        | "cancelled"
        | "expired";
      resultRef: { targetType: string; targetId: string } | null;
      failureReason: string | null;
      createdAt: string;
      updatedAt: string;
      expiresAt: string;
    };
  }>(`/api/ai/v1/conversations/${param0}/drafts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 草稿详情 GET /api/ai/v1/drafts/${param0} */
export async function aiActionDraftDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiActionDraftDetailParams,
  options?: { [key: string]: any }
) {
  const { draftId: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      draftId: string;
      ownerId: number;
      conversationId: string;
      module: "system";
      action: "user.create" | "department.create";
      schemaVersion: number;
      formData: Record<string, any>;
      missingFields: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        mustCompleteInForm: boolean;
      }[];
      validationErrors: {
        field: string;
        label: string;
        code: string;
        message: string;
      }[];
      draftVersion: number;
      status:
        | "collecting"
        | "ready"
        | "previewing"
        | "submitting"
        | "completed"
        | "failed"
        | "cancelled"
        | "expired";
      resultRef: { targetType: string; targetId: string } | null;
      failureReason: string | null;
      createdAt: string;
      updatedAt: string;
      expiresAt: string;
    };
  }>(`/api/ai/v1/drafts/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 按字段补丁更新草稿 PATCH /api/ai/v1/drafts/${param0} */
export async function aiActionDraftPatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiActionDraftPatchParams,
  body: {
    draftVersion: number;
    formData: Record<string, any>;
  },
  options?: { [key: string]: any }
) {
  const { draftId: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      draftId: string;
      ownerId: number;
      conversationId: string;
      module: "system";
      action: "user.create" | "department.create";
      schemaVersion: number;
      formData: Record<string, any>;
      missingFields: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        mustCompleteInForm: boolean;
      }[];
      validationErrors: {
        field: string;
        label: string;
        code: string;
        message: string;
      }[];
      draftVersion: number;
      status:
        | "collecting"
        | "ready"
        | "previewing"
        | "submitting"
        | "completed"
        | "failed"
        | "cancelled"
        | "expired";
      resultRef: { targetType: string; targetId: string } | null;
      failureReason: string | null;
      createdAt: string;
      updatedAt: string;
      expiresAt: string;
    };
  }>(`/api/ai/v1/drafts/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 取消草稿 POST /api/ai/v1/drafts/${param0}/cancel */
export async function aiActionDraftCancel(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiActionDraftCancelParams,
  body: {
    draftVersion: number;
  },
  options?: { [key: string]: any }
) {
  const { draftId: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: { ok: boolean };
  }>(`/api/ai/v1/drafts/${param0}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
