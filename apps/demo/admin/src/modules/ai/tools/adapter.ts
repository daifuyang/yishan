import type { UIMessage } from 'ai';
import type {
  ActionResultData,
  FormPreviewData,
  QueryData,
  ToolCallStatus,
  ToolCallViewModel,
  ToolOperationInfo,
  ToolPresentation,
} from './model';
import { TOOL_TITLES, formatToolName } from './labels';
import { record, safeSummary, safeValue, text } from './safe-data';

/**
 * 原始工具数据 → 展示模型的**唯一**转换层。
 *
 * 这个文件是纯函数集合：没有 React、没有状态、没有网络。它把 AI SDK 的流式
 * `message.parts` 折叠成稳定的 `ToolCallViewModel[]`，渲染层只认这个模型。
 *
 * 三条硬规则：
 *
 * 1. **稳定 ID**：同一次调用（`toolCallId`）在整个流式过程中只对应一个视图模型，
 *    状态变化只更新它，不新建卡片。
 * 2. **终态不可覆盖**：已经确认的成功/失败不会被迟到的输入事件或错误事件改写。
 * 3. **只信服务端**：`render.kind` 是服务端声明的展示契约，模型的输入里写什么
 *    都不影响展示模式（模型不能自己决定加载哪个组件）。
 */

/** 服务端声明的展示契约。只有这九种是可信的，其余一律按未知兜底。 */
export type TrustedRenderKind =
  | 'action.draft'
  | 'form.prefill'
  | 'action.confirm'
  | 'navigate'
  | 'form.schema'
  | 'form.options'
  | 'table'
  | 'detail'
  | 'unknown';

export interface TrustedRender {
  kind: TrustedRenderKind;
  payload: Record<string, unknown>;
}

/**
 * 解析服务端返回的 `render`。
 *
 * 这是全项目**唯一**解读 `render.kind` 的地方：展示层与「要不要自动弹表单」这类
 * 动作判定共用它，避免两套 kind 语义各自漂移。
 *
 * `unknown` 表示「服务端给了种我们不认识的展示契约」——这类结果**不**被当成可执行
 * 指令，只按兜底方式展示。
 */
export function trustedRender(output: unknown): TrustedRender | undefined {
  const envelope = record(output);
  if (envelope.ok !== true) return undefined;
  const render = record(envelope.render);
  const raw = text(render.kind);
  if (!raw) return undefined;
  const payload = record(render.payload);
  if (raw === 'action.draft') return { kind: 'action.draft', payload };
  if (raw === 'form.prefill') return { kind: 'form.prefill', payload };
  if (raw === 'action.confirm') return { kind: 'action.confirm', payload };
  if (raw === 'navigate') return { kind: 'navigate', payload };
  if (raw === 'form.schema') return { kind: 'form.schema', payload };
  if (raw === 'form.options') return { kind: 'form.options', payload };
  if (raw.endsWith('.table')) return { kind: 'table', payload };
  if (raw.endsWith('.detail')) return { kind: 'detail', payload };
  return { kind: 'unknown', payload };
}

export interface RawToolCall {
  id: string;
  toolName: string;
  state: string;
  input: unknown;
  output: unknown;
  errorText: string;
}

const TERMINAL_STATES = new Set(['output-available', 'output-error', 'output-denied']);

const stateRank = (state: string) =>
  state === 'input-streaming' ? 0 : state === 'input-available' ? 1 : 2;

function isToolPart(part: unknown): part is Record<string, unknown> {
  if (!part || typeof part !== 'object') return false;
  const type = (part as { type?: unknown }).type;
  return typeof type === 'string' && (type.startsWith('tool-') || type === 'dynamic-tool');
}

function toolNameOf(part: Record<string, unknown>): string {
  if (part.type === 'dynamic-tool') return text(part.toolName, 100);
  return text(part.type, 100).replace(/^tool-/, '');
}

/**
 * 把一条消息里的工具 part 折叠成按调用 ID 归并的原始调用序列。
 *
 * 归并规则：
 * - 同一个 `toolCallId` 只保留一条记录（**不重复建卡**）。
 * - 已经有终态的记录不再被后来的事件改写；同类的 `output-available` 可以刷新载荷
 *   （流式结果可能先给一个 preliminary 版本）。
 */
export function rawToolCalls(message: UIMessage): RawToolCall[] {
  const calls = new Map<string, RawToolCall>();
  // `message.parts` 的联合类型太宽（文本/推理/数据/工具混在一起），这里一律按
  // 「未知结构」处理：只有认得出的工具 part 才会进入后面的解析。
  for (const part of message.parts as readonly unknown[]) {
    if (!isToolPart(part)) continue;
    const id = text(part.toolCallId, 200);
    if (!id) continue;
    const state = text(part.state, 40);
    const input = 'input' in part ? part.input : undefined;
    const output = 'output' in part ? part.output : undefined;
    const errorText = text(part.errorText, 400);
    const existing = calls.get(id);
    if (!existing) {
      calls.set(id, {
        id,
        toolName: toolNameOf(part),
        state,
        input,
        output,
        errorText,
      });
      continue;
    }
    if (TERMINAL_STATES.has(existing.state)) {
      if (existing.state === 'output-available' && state === 'output-available') {
        existing.output = output ?? existing.output;
        existing.input = input ?? existing.input;
      }
      continue;
    }
    if (stateRank(state) < stateRank(existing.state)) continue;
    existing.state = state;
    existing.input = input ?? existing.input;
    existing.output = output ?? existing.output;
    existing.errorText = errorText || existing.errorText;
  }
  return [...calls.values()];
}

/** 已发现的操作元数据。 */
export type OperationInfo = ToolOperationInfo;

/**
 * 收集会话里已经发现过的操作元数据。
 *
 * 「发现 → 描述 → 查询」是三步：第一步的返回里带着后面两步要用的操作名。历史消息
 * 里的操作名可以给后续轮次复用，于是第二轮不必再问一遍「这是在查什么」。
 */
export function operationCatalog(
  messages: readonly UIMessage[],
): ReadonlyMap<string, OperationInfo> {
  const catalog = new Map<string, OperationInfo>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolPart(part)) continue;
      const output = record('output' in part ? part.output : undefined);
      if (output.ok !== true) continue;
      const data = record(output.data);
      const operations = Array.isArray(data.operations) ? data.operations : [];
      for (const operation of [data, ...operations]) {
        const item = record(operation);
        const id = text(item.id, 100);
        if (!id || !text(item.name)) continue;
        const presentation = record(item.presentation);
        catalog.set(id, {
          id,
          name: text(item.name),
          subject: text(presentation.subject),
          kind: text(presentation.kind),
        });
      }
    }
  }
  return catalog;
}

type ToolAction = 'discover' | 'describe' | 'query' | 'draft';

/** 工具名 → 它在本系统里承担的**动作**。同一个动作可以由多个工具实现。 */
const ACTION_BY_TOOL: Record<string, ToolAction> = {
  discover_operations: 'discover',
  describe_operation: 'describe',
  query_business_data: 'query',
  update_form_draft: 'draft',
  list_users: 'query',
  get_user: 'query',
  list_roles: 'query',
  get_role: 'query',
  list_departments: 'query',
  get_department: 'query',
  get_user_create_form: 'query',
  get_user_create_options: 'query',
  get_action_draft: 'query',
};

const QUERY_TITLES: Record<string, string> = {
  form: '读取表单定义',
  options: '读取表单选项',
  list: '查询业务记录',
  detail: '读取记录详情',
  draft: '读取表单草稿',
};

const PROGRESS_KINDS = new Set([
  'operations',
  'operation',
  'form',
  'options',
  'list',
  'detail',
  'draft',
  'confirmation',
]);

export interface ToolCallContext {
  /** 已发现的操作元数据，用于把 operationId 翻译成业务名。 */
  operations?: ReadonlyMap<string, OperationInfo>;
}

function statusOf(state: string, failed: boolean, streaming: boolean): ToolCallStatus {
  if (failed) return 'error';
  if (state === 'output-available') return 'success';
  if (!streaming) return 'cancelled';
  return state === 'input-streaming' ? 'pending' : 'running';
}

function firstObject(value: Record<string, unknown>): Record<string, unknown> {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return child as Record<string, unknown>;
    }
  }
  return {};
}

function queryData(payload: Record<string, unknown>): QueryData {
  const rows = Array.isArray(payload.items)
    ? payload.items.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
  const total =
    typeof payload.total === 'number' && Number.isSafeInteger(payload.total)
      ? payload.total
      : undefined;
  return {
    rows,
    total,
    truncated: payload.truncated === true,
  };
}

function draftData(payload: Record<string, unknown>): FormPreviewData {
  const interaction = record(payload.interaction);
  return {
    mode: 'draft',
    operationId: text(interaction.formKey, 100) || text(payload.formKey, 100),
    draftId: text(payload.draftId, 64) || undefined,
    draftVersion:
      typeof payload.draftVersion === 'number' ? payload.draftVersion : 1,
    status: 'collecting',
    fields: {},
    fieldDefinitions: [],
    collectedFields: [],
    missingFields: [],
    validationErrors: [],
    requestId: text(payload.uiRequestId, 100) || undefined,
  };
}

function prefillData(payload: Record<string, unknown>): FormPreviewData {
  const fields = record(payload.fields);
  const missing = Array.isArray(payload.missing)
    ? payload.missing.filter((name): name is string => typeof name === 'string')
    : [];
  return {
    mode: 'prefill',
    operationId: text(payload.target, 100),
    draftVersion: 1,
    status: 'prefill',
    fields,
    fieldDefinitions: [],
    collectedFields: Object.keys(fields),
    missingFields: missing.map((name) => ({
      name,
      label: name,
      required: false,
      mustCompleteInForm: false,
    })),
    validationErrors: [],
  };
}

function actionData(kind: 'action.confirm' | 'navigate', payload: Record<string, unknown>): ActionResultData {
  const id = payload.id;
  return {
    mode: kind === 'navigate' ? 'navigate' : 'confirm',
    target: text(payload.target, 100),
    id: typeof id === 'number' && Number.isSafeInteger(id) ? id : undefined,
    label: text(payload.label, 120) || undefined,
  };
}

function presentationOf(
  data: Record<string, unknown>,
  render: TrustedRender | undefined,
  toolName: string,
): ToolPresentation {
  if (toolName === 'discover_operations') {
    // 检索结果永远是「一组业务能力定义」。显式按列表处理：不受服务端是否附带
    // render 影响，也不会把能力对象摊平成一堆表格列。
    const operations = Array.isArray(data.operations)
      ? data.operations.filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === 'object' && !Array.isArray(item),
        )
      : [];
    return {
      type: 'query',
      data: { rows: operations, total: operations.length, truncated: false },
    };
  }
  if (!render) {
    // 没有展示契约时，只按「结果是不是一组记录」这一条**结构**事实兜底，
    // 不去猜业务语义（模型不能凭结果形状决定展示模式）。
    for (const key of ['items', 'rows', 'operations', 'list']) {
      const value = data[key];
      if (Array.isArray(value)) {
        return { type: 'query', data: queryData({ items: value }) };
      }
    }
    return { type: 'generic' };
  }
  switch (render.kind) {
    case 'table':
      return { type: 'query', data: queryData(render.payload) };
    case 'detail':
      return {
        type: 'query',
        data: { record: firstObject(render.payload), truncated: false },
      };
    case 'action.draft':
      return { type: 'form-preview', data: draftData(render.payload) };
    case 'form.prefill':
      return { type: 'form-preview', data: prefillData(render.payload) };
    case 'action.confirm':
    case 'navigate':
      return { type: 'action-result', data: actionData(render.kind, render.payload) };
    default:
      return { type: 'generic' };
  }
}

/**
 * 把一条消息里的工具调用转成展示模型。
 *
 * @param streaming 这一轮是否还在流式输出中：它决定「还没结束」的工具是「执行中」
 * 还是「已取消」。
 */
export function toToolCalls(
  message: UIMessage,
  streaming: boolean,
  context: ToolCallContext = {},
): ToolCallViewModel[] {
  return rawToolCalls(message).map((raw) => {
    const envelope = record(raw.output);
    const render = trustedRender(raw.output);
    const data = record(envelope.data);
    const progress = record(envelope.progress);
    const failed =
      raw.state === 'output-error' ||
      raw.state === 'output-denied' ||
      (raw.state === 'output-available' && envelope.ok === false);
    const complete = raw.state === 'output-available' && !failed;
    const input = record(raw.input);
    const operationId = text(input.operationId, 100);
    const operation = context.operations?.get(operationId);
    const action = ACTION_BY_TOOL[raw.toolName];
    const semantic =
      !!action &&
      text(progress.action) === action &&
      ['ready', 'empty', 'saved'].includes(text(progress.outcome)) &&
      PROGRESS_KINDS.has(text(progress.kind));
    const kind = semantic
      ? text(progress.kind)
      : operation?.kind ||
        (data.formKey ? 'form' : Array.isArray(data.items) ? 'list' : '');
    let subject = semantic
      ? text(progress.subject)
      : operation?.subject || operation?.name || '';
    const keyword = text(input.keyword);
    if (action === 'discover' && !semantic) subject = keyword;

    let title = TOOL_TITLES[raw.toolName] ?? formatToolName(raw.toolName);
    if (semantic || kind) {
      if (action === 'discover') title = '检索业务操作';
      if (action === 'describe') {
        // 「查看新增用户填写要求」——自然中文：业务名来自服务端进度，不出现工具名。
        title =
          kind === 'form' || kind === 'draft'
            ? `查看${subject || '表单'}填写要求`
            : `查看${subject || '操作'}说明`;
      }
      if (action === 'query') title = QUERY_TITLES[kind] ?? '查询业务数据';
      if (action === 'draft') {
        // 「准备新增用户信息」：写的是草稿，不是业务数据。
        title =
          kind === 'confirmation'
            ? `准备${subject || '操作'}确认`
            : `准备${subject || '表单'}信息`;
      }
    }

    let result = failed
      ? '未完成'
      : !complete
        ? streaming
          ? raw.state === 'input-streaming'
            ? '准备中'
            : '处理中'
          : '已中止'
        : '已完成';
    if (complete) {
      if (raw.toolName === 'describe_operation') result = '已完成';
      if (raw.toolName === 'discover_operations' && Array.isArray(data.operations)) {
        result = data.operations.length
          ? `找到 ${data.operations.length} 项`
          : '未找到匹配功能';
      }
      if (raw.toolName === 'query_business_data' && Array.isArray(data.items)) {
        const total =
          typeof data.total === 'number' &&
          Number.isSafeInteger(data.total) &&
          data.total >= data.items.length
            ? data.total
            : data.items.length;
        result =
          total > data.items.length
            ? `共 ${total} 条，返回 ${data.items.length} 条`
            : `找到 ${total} 条`;
      }
      if (raw.toolName === 'update_form_draft' && typeof data.draftId === 'string') {
        result = '已完成';
      }
    }

    const empty =
      complete &&
      (semantic
        ? text(progress.outcome) === 'empty'
        : (raw.toolName === 'discover_operations' &&
            Array.isArray(data.operations) &&
            !data.operations.length) ||
          (raw.toolName === 'query_business_data' &&
            Array.isArray(data.items) &&
            !data.items.length &&
            !data.total));
    if (empty) result = action === 'discover' ? '无匹配' : '无结果';

    if (complete && semantic && !empty) {
      result =
        action === 'describe'
          ? '已完成'
          : action === 'draft'
            ? '已完成'
            : '已读取';
      if (
        action === 'discover' &&
        Number.isSafeInteger(progress.count) &&
        Number(progress.count) >= 0
      ) {
        result = `命中 ${progress.count} 项`;
      }
      if (
        action === 'query' &&
        Number.isSafeInteger(progress.count) &&
        Number(progress.count) >= 0
      ) {
        result =
          Number.isSafeInteger(progress.returnedCount) &&
          Number(progress.returnedCount) < Number(progress.count)
            ? `共 ${progress.count} 条，返回 ${progress.returnedCount} 条`
            : `找到 ${progress.count} 条`;
      }
    }

    const presentation = presentationOf(data, render, raw.toolName);
    const subtitle =
      subject || text(input.description, 120) || text(input.path, 200) || '';
    const errorMessage = failed
      ? text(envelope.error, 300) || raw.errorText || '本次操作未完成，可重新生成回复。'
      : '';

    return {
      id: raw.id,
      toolName: raw.toolName,
      operationId,
      title,
      subtitle,
      status: statusOf(raw.state, failed, streaming),
      resultSummary: result,
      note: text(envelope.summary, 200) || undefined,
      summary: safeSummary(input.params ?? input),
      empty,
      // 服务端声明的展示语义：表单类操作据此写标题与摘要文案。
      kind: kind || undefined,
      // 已发现的操作元数据：让标题能写成「查看新增用户填写要求」而不是工具名。
      operation: operation
        ? {
            id: operation.id,
            name: operation.name,
            subject: operation.subject,
            kind: operation.kind,
          }
        : undefined,
      presentation,
      details: {
        input: Object.keys(record(raw.input)).length
          ? safeValue(raw.input)
          : undefined,
        output:
          (presentation.type === 'generic' ||
            raw.toolName === 'discover_operations') &&
          Object.keys(envelope).length
            ? safeValue(envelope)
            : undefined,
        error: failed ? { message: errorMessage } : undefined,
      },
    } satisfies ToolCallViewModel;
  });
}

/**
 * 每份草稿只保留**最后一次**工具调用。
 *
 * 一轮对话里助手可能多次写同一份草稿（补充字段、修正值），历史消息重放时它们会
 * 全部出现。用户只该看到最新的一份——否则同一张草稿卡片会重复出现好几次。
 */
export function latestDraftToolIds(
  messages: readonly UIMessage[],
): ReadonlySet<string> {
  const latest = new Map<string, string>();
  for (const message of messages) {
    for (const tool of toToolCalls(message, false)) {
      if (tool.presentation.type !== 'form-preview') continue;
      const data = tool.presentation.data;
      if (data.mode !== 'draft' || !data.draftId) continue;
      latest.set(data.draftId, tool.id);
    }
  }
  return new Set(latest.values());
}

/** 一份草稿的引用：补全面板据此知道该补全哪一份草稿。 */
export interface DraftToolRef {
  /** 写下这份草稿的那条消息。 */
  messageId: string;
  /** 草稿标识。 */
  draftId: string;
  /** 业务操作（`user.create`）。 */
  operationId: string;
}

/**
 * 会话里**最新**的那份草稿。
 *
 * 补全面板只认最新的一份：同一会话可能先后写过几份草稿，旧草稿不该继续
 * 拉着用户补全。工具卡片仍然是**历史记录**，两者不是一回事。
 */
export function latestDraftTool(
  messages: readonly UIMessage[],
): DraftToolRef | undefined {
  let latest: DraftToolRef | undefined;
  for (const message of messages) {
    for (const tool of toToolCalls(message, false)) {
      if (tool.presentation.type !== 'form-preview') continue;
      const data = tool.presentation.data;
      if (data.mode !== 'draft' || !data.draftId) continue;
      latest = {
        messageId: message.id,
        draftId: data.draftId,
        operationId: data.operationId,
      };
    }
  }
  return latest;
}
