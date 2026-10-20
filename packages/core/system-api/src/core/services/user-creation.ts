/**
 * user-creation.ts — 用户创建的**事务参与契约**。
 *
 * 一个 AI 草稿最多完成一次用户创建。要做到这一点，业务创建、成功回执和草稿的完成态
 * 必须在**同一个事务**里提交，而草稿表属于 AI 模块、`sys_user` 属于 System。两侧
 * 不能互相 import（Core 不依赖产品，模块之间也不越表访问），因此这里只公开一个
 * 极窄的、由**产品组合根注入**的接口。
 *
 * 三条边界，都是刻意的：
 *
 * - **不放进 contracts 包**：契约的形状里有 `AppTx`，那是后端事务句柄。
 *   contracts 是无后端依赖的共享包，塞进去会让「一份契约」变成「一份运行时依赖」。
 * - **不暴露为模型能力**：`claim`/`complete` 需要一个已持有会话与草稿行锁的事务，
 *   模型工具链拿不到、也不该拿到。业务提交仍然由用户在原生表单点击「确定」触发。
 * - **可选注入，没有就拒绝**：`SystemRuntimeOptions.userCreationParticipant` 只在
 *   AI 模块安装时由 `app.ts` 注入。带上 `draftSubmission` 却找不到参与者时，
 *   创建被拒绝 —— 静默降级成普通创建会让助手以为这次提交是幂等的。
 *
 * 版本号是**对外的并发契约**：两个标签页拿着同一个 `draftVersion` 提交，
 * 只有一个能 claim 成功，另一个拿到 409。
 */
import type { AppTx } from '@/db'
import type { CreateUserFieldsReq, UserCreateDraftFields } from '@/core/schemas/user'
import { USER_CREATE_DRAFT_FIELD_KEYS, UserCreateDraftFieldsSchema } from '@/core/schemas/user'
import { canonicalDateOnly, dateFormatFieldKeys } from '@/core/services/draft-field-format'
import { UserErrorCode } from '@yishan/core-api/business-codes/user'
import { BusinessError } from '@yishan/core-api/errors'

export type { CreateUserFieldsReq }

/** 一次草稿提交：草稿 ID + 客户端读到的精确版本。 */
export type DraftSubmission = {
  draftId: string
  draftVersion: number
}

/**
 * 业务创建完成后回写草稿的结果。
 *
 * **没有密码字段，也没有密码摘要**：回执只承载「创建了哪个用户」，
 * 因此它可以安全地作为重复提交的幂等凭据（设计 §11）。
 */
export interface DraftSubmissionFailure {
  actorId: number
  submission: DraftSubmission
  /** 给人看的业务原因，不含请求原文，也不含密码。 */
  reason: string
}

export interface UserCreationParticipant {
  /**
   * 在业务事务内认领草稿。
   *
   * 实现方负责固定「先锁会话行、再锁草稿行」的顺序（这样会话删除与草稿提交互斥），
   * 并把 `submitting` 写进**这个事务**。绝不提供事务外的等价入口：`submitting`
   * 是一条租约，没有行锁就写等于放弃互斥。
   *
   * 返回 `create` 表示继续创建；返回 `replay` 表示这份草稿早已完成过一次创建，
   * 调用方应当回读既有结果而**不再创建**。
   */
  claim(
    tx: AppTx,
    actorId: number,
    submission: DraftSubmission,
  ): Promise<
    | { kind: 'create'; fields: UserCreateDraftFields }
    | { kind: 'replay'; userId: number }
  >

  /**
   * 在**同一个事务**里写入草稿的成功回执。
   *
   * 抛错必须让整个事务回滚：用户创建与草稿完成态同生共死，
   * 「用户建成了但草稿还在」等于下一次重复提交会再建一个。
   */
  complete(tx: AppTx, actorId: number, submission: DraftSubmission, user: DraftResultRef): Promise<void>

  /**
   * 记录明确的业务失败，**可选**且**不在事务内**。
   *
   * 调用发生在事务回滚之后：草稿此刻已回到原版本与原状态，实现方以版本条件
   * 写 `failed`，因此绝不覆盖另一个请求刚提交的 `completed`。
   *
   * 选填而非必填，是因为「记录失败原因」不是幂等保证的一部分：缺少它时
   * 草稿仍然保留在原状态、仍然可编辑，语义不变。
   */
  fail?(failure: DraftSubmissionFailure): Promise<void>
}

/** 交给参与者做回执的最小用户形状（只含定位结果所需的 ID 与可展示信息）。 */
export interface DraftResultRef {
  id: number
  username?: string | null
  phone: string
  realName?: string | null
}

/**
 * 「规范化」的唯一实现。
 *
 * 规范化之后 `undefined` / `null` / 空串一律是「没有值」，数组按数字去重排序。
 * 目的是让「客户端多带了一个空格」和「客户端把 deptIds 倒着写了一遍」都不算作
 * 「提交的数据与草稿不同」—— 那两种情况是同一个意图，而不是两个不同的事实。
 * 真正的差异（手机号不同、角色不同）仍然会被下面的比较抓到。
 */
function normalizeDraftValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const ids = [...new Set(value.map(Number).filter(id => Number.isFinite(id)))].sort((a, b) => a - b)
    return ids.length ? ids : undefined
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  return value === null ? undefined : value
}

/** 规范化之后的两值是否同一个事实。数组按内容比较，顺序与重复都不算差异。 */
function sameDraftValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index])
  }
  return a === b
}

/**
 * 用户草稿里的**日期字段**。
 *
 * 派生自表单契约本身（`UserCreateDraftFieldsSchema`），因此加一个日期字段时
 * 不需要改第二处清单。
 */
const USER_CREATE_DATE_FIELD_KEYS = dateFormatFieldKeys(
  UserCreateDraftFieldsSchema.properties as unknown as Record<string, unknown>,
)

/**
 * 草稿字段的**规范形式**。
 *
 * 日期字段折成 `YYYY-MM-DD`（见 `draft-field-format.ts`）；其余字段原样。
 * 无法识别的值保持原样 —— 那是「还没填对」，由 `validationErrors` 通道负责，
 * 这里只负责消除**形状**差异。
 */
function canonicalDraftValue(key: string, value: unknown): unknown {
  if (!USER_CREATE_DATE_FIELD_KEYS.has(key)) return value
  return canonicalDateOnly(value) ?? value
}

/**
 * 用服务端草稿字段组装最终的创建字段。
 *
 * 两件事同时发生：
 *
 * 1. **服务端草稿是唯一可信来源**：最终落库的值来自草稿，不来自请求体。
 *    请求里带了某个非敏感字段却与服务端草稿不一致，就是有人在绕过「用户看到的
 *    草稿」提交另一份数据 —— 拒绝，而不是采纳请求里的那一份。
 * 2. 密码不在比较范围内：它从不进草稿，只用于**这一次**创建，且绝不持久化
 *    到草稿、回执或审计里（设计 §11）。
 *
 * 比较前双方都会折成**规范形式**（日期 → `YYYY-MM-DD`，见
 * `draft-field-format.ts`）：草稿里存的是模型给的 ISO 时间戳、原生表单回填的
 * 也是 ISO，而提交上来的永远是 `YYYY-MM-DD` —— 不折就等于拿两种形状比事实，
 * 于是每一次带草稿的创建都会被判「与服务端草稿不一致」。
 * 折叠之后落库的值也是规范形式，不把 ISO 带进 `date` 列。
 */
export function mergeDraftFields(
  draft: UserCreateDraftFields,
  submitted: Partial<CreateUserFieldsReq>,
): CreateUserFieldsReq {
  const mismatched: string[] = []
  const merged: Record<string, unknown> = {}
  for (const key of USER_CREATE_DRAFT_FIELD_KEYS) {
    const persisted = normalizeDraftValue(canonicalDraftValue(key, (draft as Record<string, unknown>)[key]))
    const supplied = normalizeDraftValue(canonicalDraftValue(key, (submitted as Record<string, unknown>)[key]))
    // 省略的字段不算不一致 —— 草稿本来就是补齐来源。
    if (supplied !== undefined && !sameDraftValue(supplied, persisted)) mismatched.push(key)
    if (persisted !== undefined) merged[key] = persisted
  }
  if (mismatched.length) {
    throw new BusinessError(
      UserErrorCode.USER_INFO_INCOMPLETE,
      `提交的数据与服务端草稿不一致：${mismatched.join('、')}`,
    )
  }
  // Media is local form input, never a model-editable draft field.
  if (submitted.avatar !== undefined) merged.avatar = submitted.avatar
  return merged as CreateUserFieldsReq
}
