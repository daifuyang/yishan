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

import {
  registerNativeFormHandle,
  clearNativeFormHandles,
  peekNativeFormSource,
  invalidateNativeFormHandle,
  restoreNativeFormHandle,
  subscribeNativeFormTarget,
  isCurrentNativeFormHandle,
  subscribeNativeFormHandles,
  subscribeNativeFormChanges,
  publishNativeFormChange,
  registerNativeDraftLink,
  peekNativeDraftLink,
  registerNativeFormOperation,
} from '@yishan/core-admin/form-assistance';
export {
  requestNativeFormAssistance,
  subscribeNativeFormAssistance,
  useAiForm,
} from '@yishan/core-admin/form-assistance';
export type {
  NativeFormFields,
  NativeFormSnapshot,
  NativeFormHandle,
} from '@yishan/core-admin/form-assistance';
export type NativeFormTarget = string;
registerNativeFormOperation({
  name: '用户',
  operationId: 'user.create',
  route: '/system/user',
  assistancePrompt: '请帮助我完善当前新建用户表单',
  fieldLabels: {
    username: '登录名称',
    realName: '真实姓名',
    nickname: '用户昵称',
    email: '邮箱',
    phone: '手机号码',
    gender: '性别',
    status: '状态',
    deptIds: '归属部门',
    roleIds: '角色',
    birthDate: '出生日期',
  },
});
registerNativeFormOperation({
  name: '部门',
  operationId: 'department.create',
  route: '/system/department',
  assistancePrompt: '请帮助我完善当前新建部门表单',
  fieldLabels: {
    name: '部门名称',
    parentId: '上级部门',
    status: '状态',
    sort_order: '排序',
    description: '描述',
    leaderId: '负责人',
  },
});
export function registerUserCreateFormHandle(
  handle: UserCreateFormHandle,
  identity: string | number = 'anonymous',
): () => void {
  return registerNativeFormHandle(handle, identity);
}
export const clearUserCreateFormHandle = clearNativeFormHandles;
export function peekUserCreateFormHandle(
  target: UserFormAssistanceTarget = USER_FORM_ASSISTANCE_TARGET,
): UserCreateFormHandle | null {
  return peekNativeFormSource(target) as UserCreateFormHandle | null;
}
export function invalidateUserCreateFormHandle(reason: string): void {
  invalidateNativeFormHandle(USER_FORM_ASSISTANCE_TARGET, reason);
}
export function restoreUserCreateFormHandle(reason: string): void {
  restoreNativeFormHandle(USER_FORM_ASSISTANCE_TARGET, reason);
}
export function subscribeUserCreateFormTarget(
  listener: (event: 'invalidated' | 'restored') => void,
): () => void {
  return subscribeNativeFormTarget(USER_FORM_ASSISTANCE_TARGET, listener);
}
export const isCurrentUserCreateFormHandle = isCurrentNativeFormHandle;
export const subscribeUserCreateFormHandle = subscribeNativeFormHandles;
export type UserCreateFormChangeListener = (snapshot: UserFormSnapshot) => void;
export function subscribeUserCreateFormChanges(
  listener: UserCreateFormChangeListener,
): () => void {
  return subscribeNativeFormChanges((snapshot) => {
    if (
      snapshot.target === 'user.create' ||
      snapshot.target === 'department.create'
    )
      listener(snapshot as UserFormSnapshot);
  });
}
export const publishUserCreateFormChange = publishNativeFormChange;
export interface UserCreateDraftSubmission {
  draftId: string;
  draftVersion: number;
}
export type UserCreateDraftReconcileResult = 'completed' | 'failed' | 'unknown';
export interface UserCreateDraftLink {
  complete?(): void;
  prepare(): Promise<UserCreateDraftSubmission | null>;
  reconcile(): Promise<UserCreateDraftReconcileResult>;
}
export function registerUserCreateDraftLink(
  link: UserCreateDraftLink,
  target: UserFormAssistanceTarget = USER_FORM_ASSISTANCE_TARGET,
): () => void {
  return registerNativeDraftLink(link, target);
}
export function peekUserCreateDraftLink(
  target: UserFormAssistanceTarget = USER_FORM_ASSISTANCE_TARGET,
): UserCreateDraftLink | null {
  return peekNativeDraftLink(target);
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
} from './overlay';
