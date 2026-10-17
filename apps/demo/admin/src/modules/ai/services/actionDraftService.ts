import {
  aiActionDraftCancel,
  aiActionDraftDetail,
  aiActionDraftList,
  aiActionDraftPatch,
} from '@/services/generated/ai';

/**
 * 草稿的网络客户端 —— **只有草稿的读写**。
 *
 * 这个文件刻意**不导出任何创建业务数据的方法**：真正的用户创建只发生在原生
 * `UserForm` 的 `onFinish` 里，用的是它自己的 `createUser`（设计 §10）。助手能做的
 * 最强的事情就是把一份临时草稿存下来，等人来点「确定」。
 *
 * 路径、请求体与响应结构一律来自 `services/generated/ai.ts`（OpenAPI 生成，勿手改），
 * 这里只做一件事：把业务信封拆开，并把失败转成一句**不含任何本地字段值**的错误文案
 * ——错误会被写进持久化审计，拼接字段值等于把用户输入带进审计体（设计 §6/§11）。
 */

type DetailResult = Awaited<ReturnType<typeof aiActionDraftDetail>>;
type ListResult = Awaited<ReturnType<typeof aiActionDraftList>>;
type CancelResult = Awaited<ReturnType<typeof aiActionDraftCancel>>;

/** 草稿的响应体由后端 schema 决定；这里只是给生成类型起个本地名字。 */
export type ActionDraft = DetailResult['data'];
export type ActionDraftMissingField = ActionDraft['missingFields'][number];
export type ActionDraftValidationError = ActionDraft['validationErrors'][number];

/** 拆信封：失败时只用服务端给的文案，不拼接任何本地字段值。 */
function unwrap<T>(
  response: { success: boolean; message: string; data: T } | undefined,
): T {
  if (!response?.success) {
    throw new Error(response?.message || '草稿操作失败，请重试');
  }
  return response.data;
}

/** 生成客户端默认走全局错误处理；这里要自己控制文案，所以关掉它。 */
const options = { skipErrorHandler: true } as const;

export async function getActionDraft(draftId: string): Promise<ActionDraft> {
  return unwrap<ActionDraft>(await aiActionDraftDetail({ draftId }, options));
}

export async function listConversationDrafts(
  conversationId: string,
): Promise<ActionDraft[]> {
  const data = unwrap<ListResult['data']>(
    await aiActionDraftList({ id: conversationId }, options),
  );
  return data.items;
}

/**
 * 字段补丁。省略的键表示「别动它」，`null` 表示「清空」——两者语义不同，不要合并。
 * 调用方**不得**把密码放进来：服务端会 400，这里也不提供任何便利。
 */
export async function patchActionDraft(
  draftId: string,
  draftVersion: number,
  formData: Record<string, string | number[] | null>,
): Promise<ActionDraft> {
  return unwrap<ActionDraft>(
    await aiActionDraftPatch({ draftId }, { draftVersion, formData }, options),
  );
}

export async function cancelActionDraft(
  draftId: string,
  draftVersion: number,
): Promise<boolean> {
  const data = unwrap<CancelResult['data']>(
    await aiActionDraftCancel({ draftId }, { draftVersion }, options),
  );
  return data.ok;
}
