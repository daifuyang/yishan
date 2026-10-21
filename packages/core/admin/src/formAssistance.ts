import {
  useEffect,
  type ComponentType,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from 'react';

export interface NativeFieldOption {
  value: number;
  label: string;
  parentValue?: number;
  description?: string;
}
export interface NativeFieldComponentProps {
  value: number[];
  onChange(value: number[]): void;
  options: readonly NativeFieldOption[];
  multiple: boolean;
  disabled: boolean;
  placeholder?: string;
}
export interface NativeFieldDefinition {
  component: string;
  placeholder?: string;
}
const fieldComponents = new Map<
  string,
  ComponentType<NativeFieldComponentProps>
>();
export function registerNativeFieldComponent(
  name: string,
  component: ComponentType<NativeFieldComponentProps>,
): () => void {
  fieldComponents.set(name, component);
  return () => {
    if (fieldComponents.get(name) === component) fieldComponents.delete(name);
  };
}
export function peekNativeFieldComponent(
  name: string,
): ComponentType<NativeFieldComponentProps> | undefined {
  return fieldComponents.get(name);
}

/** Only business-approved, non-sensitive values belong in these snapshots. */
export type NativeFormFields = Record<string, unknown>;
export interface NativeFormSnapshot {
  target: string;
  instanceId: string;
  revision: number;
  fields: NativeFormFields;
  dirtyFields: readonly string[];
}
export interface NativeFormApplyInput {
  instanceId: string;
  baseRevision: number;
  fields: NativeFormFields;
  authorizedFields?: readonly string[];
}
export interface NativeFormHandle {
  snapshot(): NativeFormSnapshot;
  open(): Promise<NativeFormSnapshot>;
  apply(
    input: NativeFormApplyInput,
  ): Promise<{ applied: boolean; conflicts: readonly string[] }>;
}
export const APPLY_CONFLICT = {
  instance: '__instance__',
  revision: '__revision__',
  closed: '__closed__',
  target: '__target__',
} as const;
export interface NativeFormOperation {
  name?: string;
  operationId: string;
  route: string;
  fieldLabels: Readonly<Record<string, string>>;
  fieldComponents?: Readonly<Record<string, NativeFieldDefinition>>;
  assistancePrompt: string;
}
const operations = new Map<string, NativeFormOperation>();
export function registerNativeFormOperation(
  operation: NativeFormOperation,
): () => void {
  operations.set(operation.operationId, operation);
  return () => {
    if (operations.get(operation.operationId) === operation)
      operations.delete(operation.operationId);
  };
}
export function peekNativeFormOperation(
  operationId: string,
): NativeFormOperation | null {
  return operations.get(operationId) ?? null;
}
interface Registration {
  identity: string;
  source: NativeFormHandle;
  handle: NativeFormHandle;
}
const registrations = new Map<string, Registration>();
const listeners = new Set<() => void>();
function emit(): void {
  for (const listener of [...listeners]) listener();
}
export function registerNativeFormHandle(
  source: NativeFormHandle,
  identity: string | number = 'anonymous',
): () => void {
  const target = source.snapshot().target;
  const registration: Registration = {
    identity: String(identity),
    source,
    handle: {
      snapshot: () => source.snapshot(),
      open: async () => {
        if (registrations.get(target) !== registration)
          throw new Error('表单协作目标已失效');
        return source.open();
      },
      apply: async (input) => {
        if (registrations.get(target) !== registration)
          return { applied: false, conflicts: [APPLY_CONFLICT.target] };
        return source.apply(input);
      },
    },
  };
  registrations.set(target, registration);
  emit();
  return () => {
    if (registrations.get(target) === registration) {
      registrations.delete(target);
      emit();
    }
  };
}
export function clearNativeFormHandles(): void {
  if (registrations.size) {
    registrations.clear();
    emit();
  }
}
export function peekNativeFormHandle(
  operationId: string,
): NativeFormHandle | null {
  return registrations.get(operationId)?.handle ?? null;
}
/** Compatibility access for contracts whose original handles enforce their own lifecycle guards. */
export function peekNativeFormSource(
  operationId: string,
): NativeFormHandle | null {
  return registrations.get(operationId)?.source ?? null;
}
export function isCurrentNativeFormHandle(handle: NativeFormHandle): boolean {
  const current = registrations.get(handle.snapshot().target);
  return current?.source === handle || current?.handle === handle;
}
export function subscribeNativeFormHandles(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const targetListeners = new Map<
  string,
  Set<(event: 'invalidated' | 'restored') => void>
>();
export function subscribeNativeFormTarget(
  operationId: string,
  listener: (event: 'invalidated' | 'restored') => void,
): () => void {
  const subscribers = targetListeners.get(operationId) ?? new Set();
  subscribers.add(listener);
  targetListeners.set(operationId, subscribers);
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) targetListeners.delete(operationId);
  };
}
export function invalidateNativeFormHandle(
  operationId: string,
  reason: string,
): void {
  void reason;
  registrations.delete(operationId);
  emit();
  for (const listener of [...(targetListeners.get(operationId) ?? [])])
    listener('invalidated');
}
export function restoreNativeFormHandle(
  operationId: string,
  reason: string,
): void {
  void reason;
  for (const listener of [...(targetListeners.get(operationId) ?? [])])
    listener('restored');
}
/** Keeps registration scoped to mount, identity and the current handle. No submit capability. */
export function useAiForm({
  handle,
  identity = 'anonymous',
  enabled = true,
  shouldRestore,
}: {
  handle: NativeFormHandle | null;
  identity?: string | number;
  enabled?: boolean;
  shouldRestore?: () => boolean;
}): void {
  useEffect(() => {
    if (!enabled || !handle) return;
    let unregister = registerNativeFormHandle(handle, identity);
    const unsubscribe = subscribeNativeFormTarget(
      handle.snapshot().target,
      (event) => {
        if (event !== 'restored' || (shouldRestore && !shouldRestore())) return;
        unregister();
        unregister = registerNativeFormHandle(handle, identity);
      },
    );
    return () => {
      unsubscribe();
      unregister();
    };
  }, [handle, identity, enabled, shouldRestore]);
}
const changes = new Set<(snapshot: NativeFormSnapshot) => void>();
export function subscribeNativeFormChanges(
  listener: (snapshot: NativeFormSnapshot) => void,
): () => void {
  changes.add(listener);
  return () => {
    changes.delete(listener);
  };
}
export function publishNativeFormChange(snapshot: NativeFormSnapshot): void {
  for (const listener of [...changes]) listener(snapshot);
}
export interface NativeDraftSubmission {
  draftId: string;
  draftVersion: number;
}
export type NativeDraftReconcileResult = 'completed' | 'failed' | 'unknown';
export interface NativeDraftLink {
  complete?(): void;
  prepare(): Promise<NativeDraftSubmission | null>;
  reconcile(): Promise<NativeDraftReconcileResult>;
}
const links = new Map<string, NativeDraftLink>();
export function registerNativeDraftLink(
  link: NativeDraftLink,
  operationId: string,
): () => void {
  links.set(operationId, link);
  return () => {
    if (links.get(operationId) === link) links.delete(operationId);
  };
}
export function peekNativeDraftLink(
  operationId: string,
): NativeDraftLink | null {
  return links.get(operationId) ?? null;
}
const assistance = new Set<(operationId: string) => void>();
export function requestNativeFormAssistance(operationId: string): void {
  for (const listener of [...assistance]) listener(operationId);
}
export function subscribeNativeFormAssistance(
  listener: (operationId: string) => void,
): () => void {
  assistance.add(listener);
  return () => {
    assistance.delete(listener);
  };
}

/**
 * AI 补全表单的**共享契约**。
 *
 * AI 侧只负责「把还缺的字段一次性收齐、合并进草稿、请用户确认」；
 * **字段长什么样、怎么校验、怎么提交**全部由业务自己的表单负责。
 * 因此这里只有一个注册表：业务注册自己的补全表单，AI 侧按 `operationId` 取用。
 *
 * 这条边界是刻意的：AI 层不新建第二套字段系统，也不替业务决定规则。
 */

/** 一个待补全字段。服务端按真实表单契约算出，形状与业务表单一一对应。 */
export interface AiCompletionField {
  /** 字段名（业务契约里的名字）。 */
  name: string;
  /** 面向用户的中文标签。 */
  label: string;
  /** 是否必填。 */
  required: boolean;
  /** 敏感字段：值不进草稿、不进模型上下文，只随提交走一次。 */
  sensitive: boolean;
  /** 选择器标识（`deptTree` / `roleOptions` / `enum` / `date` / `email` / `password` / `text`）。 */
  selector: string;
  /** 来自真实表单契约的约束子集。 */
  constraints: Record<string, unknown>;
  /** 值能不能写进 AI 草稿。 */
  draftWritable: boolean;
  /** 已填但不合法的字段：需要用户修正。 */
  invalid: boolean;
}

/** 补全表单当前持有的全部字段值。 */
export type AiFormCompletionValues = Record<string, unknown>;

/** 业务表单暴露给 AI 侧的命令式句柄。 */
export interface AiFormCompletionHandle {
  /**
   * 触发**原生表单自己的**校验。
   *
   * 通过时返回当前全部字段值；不通过时抛出，错误由表单自己显示在字段上。
   * AI 侧因此不需要知道任何一条校验规则。
   */
  validate(): Promise<AiFormCompletionValues>;
}

export interface AiFormCompletionProps {
  /** 只渲染这些字段：一次展示全部待补全字段，不一个一个地问。 */
  fields: readonly AiCompletionField[];
  /** 已有值（草稿里已经收集到的部分）。 */
  values: AiFormCompletionValues;
  /** 表单值变化时回调。 */
  onChange(values: AiFormCompletionValues): void;
  /** 只读（例如正在提交）。 */
  disabled?: boolean;
}

export type AiFormCompletionComponent = ForwardRefExoticComponent<
  AiFormCompletionProps & RefAttributes<AiFormCompletionHandle>
>;

/** 一次正式提交。 */
export interface AiFormCompletionSubmission {
  draftId: string;
  draftVersion: number;
  /**
   * 全部字段值，**包含密码这类敏感值**。
   *
   * 它只活在这一次提交里：不进草稿、不进模型上下文、不进日志。
   */
  values: AiFormCompletionValues;
}

/** 提交结果。`ok` 为假时 `message` 是给用户看的原因。 */
export interface AiFormCompletionOutcome {
  ok: boolean;
  message?: string;
}

export interface AiFormCompletionRegistration {
  /** 业务自己的补全表单。 */
  render: AiFormCompletionComponent;
  /** 走业务自己的创建接口（服务端重新鉴权、校验、保证一次草稿只创建一次）。 */
  submit(
    submission: AiFormCompletionSubmission,
  ): Promise<AiFormCompletionOutcome>;
}

const completions = new Map<string, AiFormCompletionRegistration>();
/**
 * 注册业务自己的补全表单。
 *
 * 返回注销函数：注册表是模块级的，卸载时必须摘掉，否则换一份表单后仍然命中旧的。
 */
export function registerAiFormCompletion(
  operationId: string,
  registration: AiFormCompletionRegistration,
): () => void {
  completions.set(operationId, registration);
  return () => {
    if (completions.get(operationId) === registration)
      completions.delete(operationId);
  };
}
export function peekAiFormCompletion(
  operationId: string,
): AiFormCompletionRegistration | undefined {
  return completions.get(operationId);
}

export {
  isEventInsideAssistant,
  notifyUserFormOverlay,
  peekAssistantRegion,
  peekUserFormOverlay,
  registerAssistantEscape,
  registerAssistantRegion,
  registerUserFormOverlay,
  runAssistantEscape,
  subscribeUserFormOverlay,
  useCoordinatedFormFocus,
  type UserFormOverlayInfo,
} from './formOverlay';
