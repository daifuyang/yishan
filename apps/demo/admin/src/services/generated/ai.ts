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
        module: string;
        action: string;
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
        completionFields: {
          name: string;
          label: string;
          required: boolean;
          sensitive: boolean;
          selector: string;
          constraints: Record<string, any>;
          draftWritable: boolean;
          invalid: boolean;
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
    module: string;
    action: string;
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
      module: string;
      action: string;
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
      completionFields: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        selector: string;
        constraints: Record<string, any>;
        draftWritable: boolean;
        invalid: boolean;
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
      module: string;
      action: string;
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
      completionFields: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        selector: string;
        constraints: Record<string, any>;
        draftWritable: boolean;
        invalid: boolean;
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
      module: string;
      action: string;
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
      completionFields: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        selector: string;
        constraints: Record<string, any>;
        draftWritable: boolean;
        invalid: boolean;
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

/** 读取草稿待回答问题 GET /api/ai/v1/drafts/${param0}/questions */
export async function aiDraftQuestions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiDraftQuestionsParams,
  options?: { [key: string]: any }
) {
  const { draftId: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      questions: {
        questionId: string;
        draftId: string;
        draftVersion: number;
        field: string;
        title: string;
        multiple: boolean;
        allowEmpty: boolean;
        truncated: boolean;
        options: {
          value: number;
          label: string;
          parentValue?: number;
          description?: string;
        }[];
      }[];
    };
  }>(`/api/ai/v1/drafts/${param0}/questions`, {
    method: "GET",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 回答问题并更新草稿 POST /api/ai/v1/drafts/${param0}/questions/answer */
export async function aiAnswerDraftQuestion(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.aiAnswerDraftQuestionParams,
  body: {
    conversationId: string;
    questionId: string;
    draftVersion: number;
    values: number[];
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
      module: string;
      action: string;
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
      completionFields: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        selector: string;
        constraints: Record<string, any>;
        draftWritable: boolean;
        invalid: boolean;
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
  }>(`/api/ai/v1/drafts/${param0}/questions/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 读取单模型 AI 配置 GET /api/ai/v1/settings */
export async function aiSettingsGet(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      baseUrl: string;
      model: string;
      hasApiKey: boolean;
      source: "database" | "environment" | "unconfigured";
    };
  }>("/api/ai/v1/settings", {
    method: "GET",
    ...(options || {}),
  });
}

/** 保存单模型 AI 配置 PUT /api/ai/v1/settings */
export async function aiSettingsSave(
  body: {
    baseUrl?: string;
    model: string;
    apiKey?: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: {
      baseUrl: string;
      model: string;
      hasApiKey: boolean;
      source: "database" | "environment" | "unconfigured";
    };
  }>("/api/ai/v1/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 测试已保存的 AI 配置 POST /api/ai/v1/settings/test */
export async function aiSettingsTest(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    timestamp: string;
    data: { ok: boolean; message: string };
  }>("/api/ai/v1/settings/test", {
    method: "POST",
    ...(options || {}),
  });
}
