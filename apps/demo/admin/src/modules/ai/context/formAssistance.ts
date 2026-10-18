/**
 * formAssistance —— 聊天状态与原生表单之间的**引用**（不含任何表单状态）。
 *
 * 这里刻意不放字段值、不放打开状态、不放第二套可编辑状态：可见的编辑值永远只有原生
 * `UserForm` 一处（设计 §6）。Provider 负责的只有三件事：
 *
 * 1. **本轮活动请求**：`action.draft` 结果只在本轮 stream 里被消费一次；历史消息重放、
 *    刷新、切换会话都不会重新触发自动开表单。
 * 2. **身份 epoch**：切换账号后旧的 UI 请求全部作废（设计 §7）。
 * 3. **结果回执**：草稿的最终状态（成功/失败/未落地）按 draftId 记一笔，供结果卡片
 *    展示**真实**结果，而不是让模型转述。
 */
import { createContext } from 'react';
import type { AiPrefill } from '@yishan/core-system-admin/ai-prefill';

export interface FormUiRequest {
  uiRequestId: string;
  draftId: string;
  draftVersion: number;
  identityEpoch: number;
  instanceId?: string;
  baseRevision?: number;
}

/** 一份草稿当前**真实**的结果。`message` 是给用户看的静态文案，不含任何字段值。 */
export interface DraftOutcome {
  status:
    | 'completed'
    | 'failed'
    | 'unknown'
    | 'unsupported'
    | 'blocked'
    | 'conflict'
    | 'notice';
  message: string;
}

export interface AiFormAssistanceHandlers {
  onPrefill?: (request: AiPrefill) => void;
  /** 本轮 stream 里的新草稿结果。Bridge 负责去重与自动开表单。 */
  onUiRequest: (request: FormUiRequest) => void;
  /** 用户在结果卡片上点「继续填写」。 */
  onRestore: (draftId: string) => void;
  /** 发送下一轮消息前保证待同步的非敏感字段已落地。 */
  flush: () => Promise<void>;
}

export interface AiFormAssistanceValue {
  /** 每次身份变化 +1。旧请求拿旧 epoch 的值来，等于自动作废。 */
  identityEpoch: number;
  outcomes: Record<string, DraftOutcome>;
  setOutcome: (draftId: string, outcome: DraftOutcome) => void;
  bindHandlers: (handlers: AiFormAssistanceHandlers) => () => void;
  requestRestore: (draftId: string) => void;
  requestPrefill?: (request: AiPrefill) => void;
  flush: () => Promise<void>;
}

/**
 * 单独一个 context，而不是让结果卡片去 import `AiChatProvider`：
 * 那会把整条 AI SDK 依赖链拖进任何渲染卡片的测试/入口（卡片本身并不需要聊天引擎）。
 * 值仍然是 Provider 里那**同一份** `formAssistance`，没有第二份状态。
 */
export const AiFormAssistanceContext =
  createContext<AiFormAssistanceValue | null>(null);
