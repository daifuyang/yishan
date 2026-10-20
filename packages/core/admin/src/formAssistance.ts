import { useEffect } from 'react';

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
