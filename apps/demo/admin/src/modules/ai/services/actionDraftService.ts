import { request } from '@umijs/max';

/**
 * 草稿的网络客户端 —— **只有草稿的读写**。
 *
 * 这个文件刻意**不导出任何创建业务数据的方法**：真正的用户创建只发生在原生
 * `UserForm` 的 `onFinish` 里，用的是它自己的 `createUser`（设计 §10）。助手能做的
 * 最强的事情就是把一份临时草稿存下来，等人来点「确定」。
 *
 * 手写而不是用生成客户端的原因：Task 3/4 才加的 `GET|PATCH|POST /api/ai/v1/drafts`
 * 要到 Task 10 重新生成 `services/generated` 才出现。路径与 `services/generated/ai.ts`
 * 里的会话端点同源（`/api/ai/v1`），Task 10 之后应整体改用生成客户端。
 *
 * 密码与任何字段值都不会出现在错误文案里：错误只带字段名，避免 `error.message`
 * 被写进持久化审计（设计 §6/§11）。
 */
export interface ActionDraftMissingField {
  name: string;
  label: string;
  required: boolean;
  sensitive: boolean;
  /** 只能在最终表单里补（例如密码），助手不代劳。 */
  mustCompleteInForm: boolean;
}

export interface ActionDraftValidationError {
  field: string;
  label: string;
  code: string;
  message: string;
}

export interface ActionDraft {
  draftId: string;
  ownerId: number;
  conversationId: string;
  module: string;
  action: string;
  schemaVersion: number;
  /** 非敏感字段值。**永远不含 password**（服务端白名单已经把它挡在外面）。 */
  formData: Record<string, string | number[]>;
  missingFields: ActionDraftMissingField[];
  validationErrors: ActionDraftValidationError[];
  draftVersion: number;
  status: string;
  resultRef: { targetType: string; targetId: string } | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const options = { skipErrorHandler: true };

function unwrap<T>(response: Envelope<T> | undefined): T {
  if (!response?.success) {
    // 只用服务端给的文案，不拼接任何本地字段值。
    throw new Error(response?.message || '草稿操作失败，请重试');
  }
  return response.data;
}

async function call<T>(
  url: string,
  init: { method: 'GET' | 'POST' | 'PATCH'; data?: unknown; params?: unknown },
): Promise<T> {
  // Umi 的 request 在这个调用形态下的类型推断会给出 AxiosResponse；运行时与
  // `services/user-create-form.ts` 一样直接拿到业务信封，这里保持一致。
  const response = (await request(url, {
    method: init.method,
    data: init.data,
    params: init.params,
    ...options,
  })) as unknown as Envelope<T>;
  return unwrap(response);
}

export function getActionDraft(draftId: string): Promise<ActionDraft> {
  return call<ActionDraft>(`/api/ai/v1/drafts/${draftId}`, { method: 'GET' });
}

export async function listConversationDrafts(
  conversationId: string,
): Promise<ActionDraft[]> {
  const data = await call<{ items: ActionDraft[] }>(
    `/api/ai/v1/conversations/${conversationId}/drafts`,
    { method: 'GET' },
  );
  return data.items;
}

/**
 * 字段补丁。省略的键表示「别动它」，`null` 表示「清空」——两者语义不同，不要合并。
 * 调用方**不得**把密码放进来：服务端会 400，这里也不提供任何便利。
 */
export function patchActionDraft(
  draftId: string,
  draftVersion: number,
  formData: Record<string, string | number[] | null>,
): Promise<ActionDraft> {
  return call<ActionDraft>(`/api/ai/v1/drafts/${draftId}`, {
    method: 'PATCH',
    data: { draftVersion, formData },
  });
}

export function cancelActionDraft(
  draftId: string,
  draftVersion: number,
): Promise<boolean> {
  return call<{ ok: boolean }>(`/api/ai/v1/drafts/${draftId}/cancel`, {
    method: 'POST',
    data: { draftVersion },
  }).then((data) => data.ok);
}
