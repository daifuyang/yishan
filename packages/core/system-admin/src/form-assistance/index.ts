/**
 * form-assistance — 用户与部门原生表单的协作契约。
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

/** 兼容现有用户表单调用方；部门使用相同的操作范围契约。 */
export const USER_FORM_ASSISTANCE_TARGET = 'user.create' as const;

export type UserFormAssistanceTarget =
  | typeof USER_FORM_ASSISTANCE_TARGET
  | 'department.create';

/**
 * 助手可读写的草稿字段。
 *
 * 派生自**生成的公开类型** `SystemAPI.createUserReq`（剔除 `password` 并全部转为可选），
 * 而不是从后端运行时导入 —— 前端类型与后端契约同源，但依赖方向仍是单向的。
 *
 */
export type UserCreateDraftFields = Partial<
  Omit<SystemAPI.createUserReq, 'password' | 'draftSubmission' | 'avatar'>
> &
  Partial<Omit<SystemAPI.createDeptReq, 'draftSubmission'>>;

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
   *
   * **必须**来自用户**本轮确认过的那份差异**（diff），不能来自 `Object.keys(fields)`
   * 或整个补丁：名单本身就是「用户同意覆盖」的凭据，把未讨论的字段顺手列进去等于
   * 绕过确认。
   *
   * 多带的字段名（本次补丁并不携带）会被**忽略**：授权只在 `fields` 真正写入的键上
   * 生效，因此名单无法授权一个没写进补丁的字段 —— 这一点是安全的。多带仍然算调用方
   * 的 bug（多半是把 `fields` 的键抄错了），但不必让整次补丁失败。
   */
  authorizedFields?: readonly string[];
}

export interface UserCreateFormHandle {
  snapshot(): UserFormSnapshot;
  /** 打开原生新建表单。已打开时是幂等的 —— 永远不会开出第二个表单。 */
  open(): Promise<UserFormSnapshot>;
  /**
   * 应用补丁。
   *
   * 返回时表单已经**落定**：`snapshot()` 拿到的版本就是下一次补丁该用的
   * `baseRevision`，不会因为实现内部的异步校验而突然 +1。
   *
   * `applied: true` 时 `conflicts` 仍可能非空 —— 那是「补丁写进去了，但它让某个字段
   * 变得不再合法」的提示（当前只有 `roleIds`：改了部门之后已选角色不可再授予），
   * 调用方应当把它转成对用户的一句话，而不是当成失败。
   */
  apply(
    input: UserCreateFormApplyInput,
  ): Promise<{ applied: boolean; conflicts: readonly string[] }>;
}

interface Registration {
  identity: string;
  handle: UserCreateFormHandle;
}

const registrations = new Map<UserFormAssistanceTarget, Registration>();
const listeners = new Set<() => void>();
/** 前台目标变化（被编辑表单顶替 / 顶替者关掉）的订阅者。 */
const targetListeners = new Set<(event: 'invalidated' | 'restored') => void>();

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
  const target = handle.snapshot().target;
  registrations.set(target, next);
  emit();
  return () => {
    if (registrations.get(target)?.handle === handle) {
      registrations.delete(target);
      emit();
    }
  };
}

/** 清空引用。登出/切换账号时必须调用。 */
export function clearUserCreateFormHandle(): void {
  if (!registrations.size) return;
  registrations.clear();
  emit();
}

/** 供 `useSyncExternalStore` 使用：快照必须稳定，不能每次新建对象。 */
export function peekUserCreateFormHandle(
  target: UserFormAssistanceTarget = USER_FORM_ASSISTANCE_TARGET,
): UserCreateFormHandle | null {
  return registrations.get(target)?.handle ?? null;
}

/**
 * 当「不是创建表单」的东西占据前台时，由表单内部调用以作废当前协作句柄。
 *
 * **只在打开那一刻调用**：创建表单可能仍旧开在底层，关掉顶替者之后它还是用户
 * 此刻唯一在看的目标，届时由 {@link restoreUserCreateFormHandle} 让它自己重新注册。
 */
export function invalidateUserCreateFormHandle(reason: string): void {
  // 目前只有一种原因（被编辑用户表单顶替），保留参数便于审计与后续扩展。
  void reason;
  registrations.delete(USER_FORM_ASSISTANCE_TARGET);
  emit();
  for (const listener of [...targetListeners]) listener('invalidated');
}

/**
 * 顶替创建表单的东西（编辑用户表单）关掉了。此时仍开着的创建表单会自己重新注册 ——
 * 注册 effect 的依赖是稳定的，没有这次通知它永远等不到「可以回来了」。
 */
export function restoreUserCreateFormHandle(reason: string): void {
  void reason;
  for (const listener of [...targetListeners]) listener('restored');
}

/** 订阅前台目标变化。创建表单用它在自己被顶替/被归还之间切换注册状态。 */
export function subscribeUserCreateFormTarget(
  listener: (event: 'invalidated' | 'restored') => void,
): () => void {
  targetListeners.add(listener);
  return () => {
    targetListeners.delete(listener);
  };
}

/**
 * 句柄是否仍是当前注册的那一个。
 *
 * 已经被顶替的旧句柄（例如编辑用户表单打开之前的创建句柄）必须停止接受补丁 ——
 * 它的表单可能还开在底层，但那已经不是用户此刻在看的目标。
 */
export function isCurrentUserCreateFormHandle(
  handle: UserCreateFormHandle,
): boolean {
  return registrations.get(handle.snapshot().target)?.handle === handle;
}

export function subscribeUserCreateFormHandle(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ============================================================================
 * 草稿联动（Task 9，设计 §6/§9/§10）
 *
 * 上面那个句柄刻意只有 `snapshot / open / apply`：**能读、能开、能填，不能提交**。
 * 但「用户边填边把非敏感字段同步回草稿」和「提交前锁定精确草稿版本」这两件事必然要
 * 有接缝，于是有**第二个**、同样没有业务能力的窄接口：
 *
 * - 变化订阅：表单每次可见值变化后**推**一份快照出去。产品侧据此合并延迟后 PATCH。
 *   推送的是快照，因此密码永远不在里面（`snapshot.fields` 已剔除）。
 * - 草稿链接：由**产品侧**注册，表单在人工「确定」里调用。它只有两个方法，
 *   `prepare()`（同步 + 返回精确版本）与 `reconcile()`（网络异常后**只读**查询草稿）。
 *   两者都不含「创建」这个动作：表单仍然用**自己的** `createUser`。
 * ==========================================================================*/

/** 表单可见值变化时推给产品侧的非敏感快照。**永远不含 password。** */
export type UserCreateFormChangeListener = (snapshot: UserFormSnapshot) => void;

const changeListeners = new Set<UserCreateFormChangeListener>();

/** 订阅表单变化。用于「手动修改按字段合并同步到草稿」（设计 §6）。 */
export function subscribeUserCreateFormChanges(
  listener: UserCreateFormChangeListener,
): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/** 由 `UserForm` 调用：把一次变化后的快照推给订阅者。 */
export function publishUserCreateFormChange(snapshot: UserFormSnapshot): void {
  for (const listener of [...changeListeners]) listener(snapshot);
}

/** 提交时要携带的草稿关联。**不含任何字段值。** */
export interface UserCreateDraftSubmission {
  draftId: string;
  draftVersion: number;
}

/**
 * 创建请求抛异常后的**只读**判断结果。
 *
 * `unknown` 覆盖「草稿仍在 submitting」与「查询本身也失败」两种情况：两种都**不允许**
 * 自动重发创建（设计 §11），用户看到的是「正在核对，请稍后刷新」。
 */
export type UserCreateDraftReconcileResult = 'completed' | 'failed' | 'unknown';

export interface UserCreateDraftLink {
  /** 原生业务 API 已返回成功，仅同步显示回执。 */
  complete?(): void;
  /**
   * 人工点击「确定」后、表单校验通过后调用：把待同步的非敏感字段落地，并返回**锁定**
   * 的精确 `{draftId, draftVersion}`。没有草稿时返回 `null`（普通创建，行为不变）。
   *
   * **不允许**在这里发起创建：这个方法只与草稿有关。
   */
  prepare(): Promise<UserCreateDraftSubmission | null>;
  /**
   * 创建请求抛异常后调用，**只读**查询草稿当前状态。
   *
   * 客户端的 `confirmed` 不是授权证明，同理「重试一次」也不是幂等策略：真正的幂等由
   * 服务端事务保证（设计 §11），这里只是把结果如实显示给用户。
   */
  reconcile(): Promise<UserCreateDraftReconcileResult>;
}

const draftLinks = new Map<UserFormAssistanceTarget, UserCreateDraftLink>();

/**
 * 注册草稿链接。**没有草稿时不必注册** —— `peekUserCreateDraftLink()` 返回 `null` 时
 * 表单走的是与从前完全一致的普通创建路径。
 */
export function registerUserCreateDraftLink(
  link: UserCreateDraftLink,
  target: UserFormAssistanceTarget = USER_FORM_ASSISTANCE_TARGET,
): () => void {
  draftLinks.set(target, link);
  return () => {
    if (draftLinks.get(target) === link) draftLinks.delete(target);
  };
}

/** 供 `UserForm` 在人工提交里读取。`null` 表示这次是与草稿无关的普通创建。 */
export function peekUserCreateDraftLink(
  target: UserFormAssistanceTarget = USER_FORM_ASSISTANCE_TARGET,
): UserCreateDraftLink | null {
  return draftLinks.get(target) ?? null;
}

/**
 * 浮层/焦点协作（设计 §4）。与上面的补丁契约同属公开接缝，但**不含任何业务数据**：
 * 只有业务浮层是否开着、助手面板的 DOM 在哪、焦点该还给谁。
 */
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
} from './overlay';

const assistanceListeners = new Set<
  (target: UserFormAssistanceTarget) => void
>();
export function requestNativeFormAssistance(
  target: UserFormAssistanceTarget,
): void {
  for (const listener of assistanceListeners) listener(target);
}
export function subscribeNativeFormAssistance(
  listener: (target: UserFormAssistanceTarget) => void,
): () => void {
  assistanceListeners.add(listener);
  return () => {
    assistanceListeners.delete(listener);
  };
}

/** 操作中性名称；旧 UserCreate 名称保留兼容已有调用方。 */
export type NativeFormTarget = UserFormAssistanceTarget;
export type NativeFormFields = UserCreateDraftFields;
export type NativeFormSnapshot = UserFormSnapshot;
export type NativeFormHandle = UserCreateFormHandle;
