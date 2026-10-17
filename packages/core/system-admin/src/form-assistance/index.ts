/**
 * form-assistance — 页面/表单**协作契约**（首期只有 `system / user.create`）。
 *
 * 这个模块是助手与原生表单之间唯一的接缝，也是**唯一**允许外界触碰表单的东西。
 * 契约刻意很窄：
 *
 * - **没有 submit。** 业务创建永远由用户在原有「确定」按钮上完成；聊天里的
 *   「直接创建」「我确认了」拿不到任何能提交的句柄。
 * - **没有密码。** `UserCreateDraftFields` 派生自生成的 `createUserReq` 并剔除
 *   `password`；快照里也不会出现它，补丁入口再拒一次。
 * - **没有 form 实例 / setOpen / loading。** 开关、表单实例、加载与提交生命周期
 *   留在 `UserForm` 内部（设计 §5）。
 * - **没有 CSS 选择器、屏幕识别、模拟点击或通用 DOM 操作**（设计 §5）。
 *
 * 单一数据来源（设计 §6）：打开的原生表单是可见编辑值的唯一来源，**没有第二套
 * 可编辑状态**。`revision` 由表单维护；助手基于 `snapshot()` 拿到的版本应用补丁，
 * 期间用户又改了字段就会因版本不符被拒绝，从而不会把用户的手改覆盖掉。
 *
 * 注册是显式订阅（与既有 `ai-prefill` 同一模式），不引入全局状态库：
 * System Admin 不导入 Demo AI 模块，Demo AI 模块反过来订阅这里。
 */

/** 首期唯一接入的业务目标。未接入的页面必须明说暂不支持。 */
export const USER_FORM_ASSISTANCE_TARGET = 'user.create' as const;

export type UserFormAssistanceTarget = typeof USER_FORM_ASSISTANCE_TARGET;

/**
 * 助手可读写的草稿字段。
 *
 * 派生自**生成的公开类型** `SystemAPI.createUserReq`（剔除 `password` 并全部转为可选），
 * 而不是从后端运行时导入 —— 前端类型与后端契约同源，但依赖方向仍是单向的。
 *
 * 已知缺口：Task 5 给 `CreateUserReqSchema` 加了可选的 `draftSubmission`，
 * 但生成的 OpenAPI 客户端要到 Task 10 才重新生成，因此这里看到的
 * `createUserReq` 还没有该字段。Task 10 之后本类型自动跟随，无需改动。
 */
export type UserCreateDraftFields = Partial<Omit<SystemAPI.createUserReq, 'password'>>;

/** 冲突原因标记。字段名本身也用作冲突项，便于调用方逐字段展示差异。 */
export const APPLY_CONFLICT = {
  /** 请求针对的表单实例已经不是当前实例（被关闭、重开或换成了别的表单）。 */
  instance: '__instance__',
  /** 版本不符：读取快照之后表单又被改过（含「等待确认期间用户又手改」）。 */
  revision: '__revision__',
  /** 表单已关闭。 */
  closed: '__closed__',
  /** 打开的是编辑用户表单之类的非创建目标。 */
  target: '__target__',
} as const;

export interface UserFormSnapshot {
  target: UserFormAssistanceTarget;
  /** 一次「打开」的标识。重新打开会换新值，迟到的补丁因此被拒。 */
  instanceId: string;
  /** 表单当前版本。任何可见值变化都会 +1。 */
  revision: number;
  /** 当前非敏感字段值。**永远不含 password。** */
  fields: UserCreateDraftFields;
  /** 被用户手动改过（且当前非空）的字段；覆盖它们需要确认。 */
  dirtyFields: readonly string[];
}

export interface UserCreateFormApplyInput {
  instanceId: string;
  baseRevision: number;
  fields: Partial<UserCreateDraftFields>;
  /**
   * 用户**本轮明确要求修改**的字段（例如「把手机号改成 X」）。
   *
   * 不在名单里的字段：空值 → 直接补；非空且被用户手改过 → 返回冲突，
   * 由调用方展示原值与拟修改值的差异让用户确认，确认后带上本名单重试。
   *
   * 这是 brief 签名上的**可选增量**：不传时行为等价于「没有任何字段被明确授权」。
   */
  authorizedFields?: readonly string[];
}

export interface UserCreateFormHandle {
  snapshot(): UserFormSnapshot;
  /** 打开原生新建表单。已打开时是幂等的 —— 永远不会开出第二个表单。 */
  open(): Promise<UserFormSnapshot>;
  apply(input: UserCreateFormApplyInput): Promise<{ applied: boolean; conflicts: readonly string[] }>;
}

interface Registration {
  identity: string;
  handle: UserCreateFormHandle;
}

let active: Registration | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

/**
 * 注册当前可协作的创建表单。返回注销函数；卸载时调用即可摘掉引用。
 *
 * `identity` 是当前登录身份（通常 `currentUser.id`）。身份变化时旧引用立即作废 ——
 * 否则切换账号后助手还能操作上一个账号的表单。
 */
export function registerUserCreateFormHandle(
  handle: UserCreateFormHandle,
  identity: string | number = 'anonymous',
): () => void {
  const next: Registration = { identity: String(identity), handle };
  active = next;
  emit();
  return () => {
    if (active?.handle === handle) {
      active = null;
      emit();
    }
  };
}

/** 清空引用。登出/切换账号时必须调用。 */
export function clearUserCreateFormHandle(): void {
  if (!active) return;
  active = null;
  emit();
}

/** 供 `useSyncExternalStore` 使用：快照必须稳定，不能每次新建对象。 */
export function peekUserCreateFormHandle(): UserCreateFormHandle | null {
  return active?.handle ?? null;
}

/** 当「不是创建表单」的东西占据前台时，由表单内部调用以作废当前协作句柄。 */
export function invalidateUserCreateFormHandle(reason: string): void {
  if (!active) return;
  // 目前只有一种原因（被编辑用户表单顶替），保留参数便于审计与后续扩展。
  void reason;
  clearUserCreateFormHandle();
}

/**
 * 句柄是否仍是当前注册的那一个。
 *
 * 已经被顶替的旧句柄（例如编辑用户表单打开之前的创建句柄）必须停止接受补丁 ——
 * 它的表单可能还开在底层，但那已经不是用户此刻在看的目标。
 */
export function isCurrentUserCreateFormHandle(handle: UserCreateFormHandle): boolean {
  return active?.handle === handle;
}

export function subscribeUserCreateFormHandle(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
