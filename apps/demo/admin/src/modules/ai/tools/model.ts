import type { ComponentType } from 'react';

/**
 * 工具调用的**展示模型**。
 *
 * 原始工具数据（`message.parts` 里的 tool part）与展示数据是两层：原始层是 AI SDK
 * 的流式事件，前端不直接渲染它；展示层由 `adapters/tool-progress` 之外的
 * `tools/adapter.ts` 从原始层**纯函数**推导出来。
 *
 * 三条边界：
 * 1. `toolName` 是**实际执行的工具**（`query_business_data`），
 *    `operationId` 是**业务操作**（`user.list`），`presentation.type` 是**展示模式**
 *    （`query`）——三者不是一回事，不能合并成一个字段。
 * 2. `status` 只由**真实事件**驱动（part.state + output.ok），不采信模型的自述。
 * 3. `details` 是调试用的原始载荷，永远经过脱敏；`summary` 是给人看的少量标量。
 */
export type ToolCallStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';

export type ToolPresentationType =
  | 'generic'
  | 'query'
  | 'form-preview'
  | 'action-result';

export interface ToolSummaryItem {
  label: string;
  value: string;
}

export interface PreviewMissingField {
  name: string;
  label: string;
  required: boolean;
  /** 敏感字段：只提示「需在原生表单填写」，绝不回显值。 */
  sensitive?: boolean;
  mustCompleteInForm: boolean;
}

export interface PreviewValidationError {
  label: string;
  message: string;
}

/** 表单草稿预览数据。值以服务器草稿为准，前端只做展示与「继续填写」入口。 */
export interface FormPreviewData {
  mode: 'draft' | 'prefill';
  operationId: string;
  draftId?: string;
  draftVersion: number;
  status: string;
  fields: Record<string, unknown>;
  fieldDefinitions: {
    name: string;
    label: string;
    required: boolean;
    sensitive: boolean;
  }[];
  collectedFields: string[];
  missingFields: PreviewMissingField[];
  validationErrors: PreviewValidationError[];
  /** 服务端给的请求标识：同一个 uiRequestId 只消费一次。 */
  requestId?: string;
}

/**
 * 已发现的操作元数据。
 *
 * 工具调用本身只说「我调了哪个工具」，业务名（「新增用户」）来自会话里
 * 已经发现过的能力定义。有了它，标题才能写成自然中文而不是工具名。
 */
export interface ToolOperationInfo {
  /** 业务操作标识（`user.create`）。 */
  id: string;
  /** 面向用户的操作名（「新增用户」）。 */
  name: string;
  /** 业务对象（「用户」）。 */
  subject: string;
  /** 服务端声明的展示类型（`form` / `draft` / `list` …）。 */
  kind: string;
}

export interface QueryColumn {
  key: string;
  label: string;
  format?: 'status' | 'gender' | 'scope';
}

/** 查询结果。数组、单对象、分页数据都必须能被这一种形状承载。 */
export interface QueryData {
  rows?: Record<string, unknown>[];
  record?: Record<string, unknown>;
  columns?: QueryColumn[];
  total?: number;
  truncated: boolean;
  notice?: string;
}

/** 明确的业务操作结果：跳转，或需要人工确认的动作。 */
export interface ActionResultData {
  mode: 'navigate' | 'confirm';
  target: string;
  id?: number;
  label?: string;
}

export type ToolPresentation =
  | { type: 'generic'; data?: unknown }
  | { type: 'query'; data: QueryData }
  | { type: 'form-preview'; data: FormPreviewData }
  | { type: 'action-result'; data: ActionResultData };

export interface ToolCallViewModel {
  /** 稳定的调用 ID：同一次调用在流式过程中永远是同一个值。 */
  id: string;
  /** 实际执行的工具名。 */
  toolName: string;
  /** 业务操作标识（`user.list` 之类），可能为空。 */
  operationId: string;
  /** 面向用户的操作标题。 */
  title: string;
  /** 当前操作的上下文：对象、路径、命令、检索词。 */
  subtitle: string;
  status: ToolCallStatus;
  /** 一句话结果摘要（「共 20 条，返回 1 条」）。 */
  resultSummary: string;
  /**
   * 服务端给出的一句话结果说明（面向用户）。
   *
   * 与 `resultSummary` 分开：前者是**状态**（由事件推导），后者是**这次结果是什么**
   * （由服务端写给用户看）。模型正文里那句重复的话会被去重，因此必须在这里显示。
   */
  note?: string;
  /** 少量安全的标量参数摘要。 */
  summary: ToolSummaryItem[];
  /** 执行成功但没有任何匹配结果。 */
  empty: boolean;
  /** 服务端声明的展示语义（`form` / `draft` / `list` / `operation` …）。 */
  kind?: string;
  /** 已发现的操作元数据；用来把标题翻译成自然中文。 */
  operation?: ToolOperationInfo;
  presentation: ToolPresentation;
  details: {
    input?: unknown;
    /** 只有兜底展示才带原始输出；有专属 Renderer 的结果由 Renderer 自己呈现。 */
    output?: unknown;
    error?: { message: string };
  };
}

export interface ToolRendererProps {
  tool: ToolCallViewModel;
  /** 由统一工具组提供外壳时，仅渲染只读结果。 */
  bodyOnly?: boolean;
}

export type ToolRenderer = ComponentType<ToolRendererProps>;
