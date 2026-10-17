/**
 * ai-prefill — AI 预填的一次性暂存。
 *
 * 为什么是「暂存」而不是 URL 参数：预填里可能有手机号、邮箱、部门归属这类
 * 个人信息。放进 query 就会进浏览器历史、进 Referer、进运维访问日志，
 * 甚至被截图分享出去。放内存里则刷新即失——这正是我们要的语义：预填是一次
 * 「打开表单」的邀请，不是可分享的链接。
 *
 * 因此本模块**刻意**没有持久化实现，也不要加 localStorage/sessionStorage 兜底。
 */

export type AiPrefillTarget = 'user.create' | 'user.update' | 'department.create'

export interface AiPrefill {
  readonly target: AiPrefillTarget
  readonly fields: Readonly<Record<string, unknown>>
  /** 模型没能提取到的必填字段，用于在表单里高亮提示。 */
  readonly missing: readonly string[]
}

/** 预填允许出现的路由白名单。模型给的是 target，真实路由由这里决定。 */
export const AI_PREFILL_ROUTES: Record<AiPrefillTarget, string> = {
  'user.create': '/system/user',
  'user.update': '/system/user',
  'department.create': '/system/department',
}

/** 预填里绝不接受凭据类字段。模型不该持有它们，前端也不该替它们兜底。 */
const FORBIDDEN_FIELDS = new Set(['password', 'oldPassword', 'newPassword', 'token', 'secret', 'privateKey'])

/** 暂存有效期。过期即丢弃，避免用户几分钟后点「打开表单」填进去一堆旧字段。 */
const TTL_MS = 5 * 60 * 1000

let pending: (AiPrefill & { at: number }) | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeAiPrefill(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener);
  }
}

function alive(): boolean {
  return pending !== null && Date.now() - pending.at < TTL_MS
}

/** 供 useSyncExternalStore 使用；快照必须稳定，不能每次新建对象。 */
export function peekAiPrefill(): AiPrefill | null {
  if (!alive()) {
    if (pending) pending = null;
    return null;
  }
  return pending;
}

export function setAiPrefill(prefill: AiPrefill): void {
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(prefill.fields ?? {})) {
    if (FORBIDDEN_FIELDS.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    fields[key] = value;
  }
  pending = { target: prefill.target, fields, missing: [...(prefill.missing ?? [])], at: Date.now() };
  emit();
}

/**
 * 取出并清空（一次性）。
 *
 * 传 `target` 时只接受匹配的预填——否则在用户页打开部门表单会串数据。
 */
export function consumeAiPrefill(target?: AiPrefillTarget): AiPrefill | null {
  const current = peekAiPrefill();
  // 只在真的取走了东西时才通知。订阅方是「取到了就取用」的回调：
  // 无条件 emit 会形成 consume → emit → consume 的自激循环，
  // 页面渲染时直接爆 "Maximum call stack size exceeded"。
  if (current) {
    pending = null;
    emit();
  }
  if (!current) return null;
  return target && current.target !== target ? null : current;
}

export function clearAiPrefill(): void {
  pending = null;
  emit();
}
