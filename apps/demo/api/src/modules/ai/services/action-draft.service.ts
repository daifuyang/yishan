/**
 * action-draft.service.ts — AI 助手的**持久化、版本化草稿**。
 *
 * 草稿是恢复快照与提交协调的底座：用户刷新后还能接着填，多个标签页/迟到的工具
 * 结果不会互相覆盖，取消与完成的草稿不会被复活，有效期固定 24 小时（设计 §9、§11）。
 *
 * 四条不可放宽的规则：
 *
 * 1. **归属是「一个人 + 一个会话」**。每一次读、改、取消、提交都两个条件一起校验；
 *    查不到就是 404，不区分「不存在」与「是别人的」。
 * 2. **并发用 CAS，不用租约**。`submitting` 只在事务内写入（`withSubmissionLock`），
 *    事务外的乐观并发完全交给 `draft_version`。零行更新会被翻译成 404/409，
 *    而不是被当成「行不存在」。
 * 3. **校验用真实业务定义**。字段白名单来自 Task 2 的 `UserCreateDraftFieldsSchema`，
 *    必填/标签来自 Task 3 的 `UserCreationFormService.getCreateForm()`，
 *    部门/角色授权复用 Task 2 的 `validateUserCreation`。这里**不复制**任何一份规则。
 * 4. **业务格式错误保留原值**。手机号打了一半不是拒绝理由：值照存，错误进
 *    `validationErrors`。只有「形状不合法」（未知字段、密码、类型错误）才当场拒绝。
 */
import { randomUUID } from 'node:crypto'
import {
  UserCreationFormService,
  USER_CREATE_FORM_SCHEMA_VERSION,
  validateUserCreation,
  type UserCreateForm,
  type UserCreationSubject,
} from '@yishan/core-system-api'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import { ActionDraftRepository, type ActionDraftRecord, type ActionDraftStore, type ActionDraftTx } from '../repositories/action-draft.repository.js'
import { aiError } from '../ai-chat-error.js'
import {
  ACTION_DRAFT_ACTIONS,
  ACTION_DRAFT_MODULES,
  ACTION_DRAFT_TTL_MS,
  ACTION_DRAFT_STATUSES,
  EDITABLE_ACTION_DRAFT_STATUSES,
  USER_CREATE_DRAFT_FIELD_KEYS,
  matchesDraftFieldType,
  type ActionDraftAction,
  type ActionDraftModule,
  type ActionDraftResultRef,
  type ActionDraftStatus,
} from '../schemas/action-draft.schema.js'

export { ACTION_DRAFT_TTL_MS } from '../schemas/action-draft.schema.js'
export type { ActionDraftRecord, ActionDraftStore, ActionDraftTx } from '../repositories/action-draft.repository.js'

export type ActionDraft = ActionDraftRecord

export interface CreateActionDraftInput {
  module: string
  action: string
  formData: Record<string, unknown>
  /** 模型上次读到的表单版本；带了就必须与当前一致，否则要求重新读表单。 */
  schemaVersion?: number
  /** 提供时才跑授权；生产路径由调用方从认证身份构造。 */
  subject?: UserCreationSubject
}

export interface PatchActionDraftInput {
  schemaVersion?: number
  subject?: UserCreationSubject
}

export interface ActionDraftServiceOptions {
  now?: () => Date
  ttlMs?: number
  /** 注入表单定义（测试用）；生产路径读真实的 `getCreateForm()`。 */
  form?: UserCreateForm
  /** 注入授权规则（测试用）；生产路径是 Task 2 的 `validateUserCreation`。 */
  authorize?: (subject: UserCreationSubject, fields: Record<string, unknown>) => Promise<void>
}

const EDITABLE_FIELDS = new Set<string>(USER_CREATE_DRAFT_FIELD_KEYS)

/** 允许 `null` 的补丁值：`null` 清空，省略不动。 */
function isPatch(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 「这个字段有值吗」的**唯一**判定。
 *
 * `undefined` / `null` / 空串都算没有。它必须与 `normalize()` 的 null 语义一致：
 * 一个字段不可能同时「被清空」和「已收集」，否则草稿会对提交接口撒谎。
 */
function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

export class ActionDraftService {
  constructor(
    private readonly store: ActionDraftStore,
    private readonly options: ActionDraftServiceOptions = {},
  ) {}

  static forDatabase(db: AppQueryDb) {
    return new ActionDraftService(new ActionDraftRepository(db))
  }

  private now() { return this.options.now ? this.options.now() : new Date() }
  private ttlMs() { return this.options.ttlMs ?? ACTION_DRAFT_TTL_MS }
  private form(): UserCreateForm { return this.options.form ?? UserCreationFormService.getCreateForm() }
  private async authorize(subject: UserCreationSubject | undefined, fields: Record<string, unknown>) {
    if (!subject) return
    await (this.options.authorize ?? ((s, f) => validateUserCreation(s, f)))(subject, fields)
  }

  // ---------------------------------------------------------------- 读

  /**
   * 读取一份**当前用户可见且未过期**的草稿。
   *
   * 过期在这里落地为状态而不是只在内存里算：`get` 把行改成 `expired` 再报 409，
   * 于是「迟到的工具结果读到的过期草稿」和「列表里显示的过期草稿」说的是同一件事。
   */
  async get(ownerId: number, draftId: string): Promise<ActionDraft> {
    const row = await this.store.find(ownerId, draftId)
    if (!row) throw aiError(404, '草稿不存在')
    if (row.status !== 'expired' && row.expiresAt.getTime() <= this.now().getTime()) {
      await this.expire(row)
      throw aiError(409, '草稿已过期，请重新开始填写')
    }
    if (row.status === 'expired') throw aiError(409, '草稿已过期，请重新开始填写')
    return row
  }

  async list(ownerId: number, conversationId: string): Promise<ActionDraft[]> {
    return this.store.listByConversation(ownerId, conversationId)
  }

  // ---------------------------------------------------------------- 写

  async create(ownerId: number, conversationId: string, input: CreateActionDraftInput): Promise<ActionDraft> {
    this.assertTarget(input.module, input.action)
    this.assertSchemaVersion(input.schemaVersion)
    const formData = this.normalize(input.formData, false)
    await this.authorize(input.subject, formData)
    const now = this.now()
    const evaluation = this.evaluate(formData)
    const draft: ActionDraft = {
      draftId: randomUUID(),
      ownerId,
      conversationId,
      module: input.module,
      action: input.action,
      schemaVersion: USER_CREATE_FORM_SCHEMA_VERSION,
      formData,
      missingFields: evaluation.missingFields,
      validationErrors: evaluation.validationErrors,
      draftVersion: 1,
      status: evaluation.status,
      resultRef: null,
      failureReason: null,
      // 有效期自**创建**起算，之后任何编辑都不续期（设计 §9）。
      expiresAt: new Date(now.getTime() + this.ttlMs()),
      createdAt: now,
      updatedAt: now,
    }
    return this.store.transaction(async tx => {
      // 先锁会话行：会话不存在或不属于当前用户，一律 404，不泄露别的会话。
      if (!await tx.conversationExists(ownerId, conversationId)) throw aiError(404, '会话不存在')
      return tx.insert(draft)
    }, { ownerId, conversationId })
  }

  async patch(ownerId: number, draftId: string, draftVersion: number, formData: Record<string, unknown>, context: PatchActionDraftInput = {}): Promise<ActionDraft> {
    this.assertSchemaVersion(context.schemaVersion)
    const patch = this.normalize(formData, true)
    const row = await this.get(ownerId, draftId)
    if (row.draftVersion !== draftVersion) throw conflict(this.explain(row, draftVersion))
    // 补丁合并：省略的键不动，`null` 的键移除。未提及的字段必须原样保留（设计 §6）。
    const merged = { ...row.formData }
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete merged[key]
      else merged[key] = value
    }
    await this.authorize(context.subject, merged)
    const evaluation = this.evaluate(merged)
    return this.swap(ownerId, row, draftVersion, EDITABLE_ACTION_DRAFT_STATUSES, {
      formData: merged,
      missingFields: evaluation.missingFields,
      validationErrors: evaluation.validationErrors,
      // 编辑失败草稿就是把它救回来：状态回到收集/就绪，不留在 failed。
      status: evaluation.status,
      failureReason: null,
    }, `草稿信息尚未齐全，请在表单中补齐 ${row.missingFields.map(field => field.label).join('、')}`)
  }

  async cancel(ownerId: number, draftId: string, draftVersion: number): Promise<ActionDraft> {
    const row = await this.get(ownerId, draftId)
    if (row.draftVersion !== draftVersion) throw conflict(this.explain(row, draftVersion))
    return this.swap(ownerId, row, draftVersion, EDITABLE_ACTION_DRAFT_STATUSES, { status: 'cancelled' }, '草稿已取消，无法再次修改')
  }

  // ------------------------------------------------------------ 提交流程

  /**
   * 进入提交 —— **只能在 `withSubmissionLock` 拿到的事务里调用**。
   *
   * 刻意不提供事务外的等价物：`submitting` 是一条租约，只有持有会话行锁的事务
   * 才有资格写入它，否则「提交中」这一状态可以在没有任何互斥的情况下被写进去，
   * 会话删除的 409 守卫也就形同虚设。方法名带 `InTx` 就是这个契约的载体。
   *
   * Task 9 的用法：
   * ```ts
   * await service.withSubmissionLock(ownerId, conversationId, draftId, async (tx, draft) => {
   *   const submitting = await service.markSubmittingInTx(tx, draft)
   *   return createUser(submitting.formData)
   * })
   * ```
   */
  async markSubmittingInTx(tx: ActionDraftTx, row: ActionDraft): Promise<ActionDraft> {
    // 先取版本号：CAS 之后不能再从 row 上算，某些 store 会就地修改该对象。
    const expectedVersion = row.draftVersion
    const updated = await tx.compareAndSwap({
      ownerId: row.ownerId,
      draftId: row.draftId,
      expectedVersion,
      allowedStatuses: ['ready', 'previewing', 'failed'],
      patch: { status: 'submitting', failureReason: null },
    })
    if (updated) return { ...row, status: 'submitting', failureReason: null, draftVersion: expectedVersion + 1 }
    // 零行不是「行不存在」：在归属范围内重读一次再翻译成 409。
    const current = await tx.find(row.ownerId, row.draftId)
    if (!current) throw aiError(404, '草稿不存在')
    throw conflict(this.explain(current, expectedVersion))
  }

  /** 提交成功：只保存结果引用，不保存任何密码材料（设计 §11）。 */
  async markCompleted(ownerId: number, draftId: string, draftVersion: number, resultRef: ActionDraftResultRef): Promise<ActionDraft> {
    const row = await this.get(ownerId, draftId)
    if (row.draftVersion !== draftVersion) throw conflict(this.explain(row, draftVersion))
    return this.swap(ownerId, row, draftVersion, ['submitting'], { status: 'completed', resultRef })
  }

  /**
   * 提交失败：草稿**保留且可编辑**。
   *
   * `failureReason` 是给人看的业务原因，不是请求原文，也不是密码。
   */
  async markFailed(ownerId: number, draftId: string, draftVersion: number, reason: string): Promise<ActionDraft> {
    const row = await this.get(ownerId, draftId)
    if (row.draftVersion !== draftVersion) throw conflict(this.explain(row, draftVersion))
    return this.swap(ownerId, row, draftVersion, ['submitting'], { status: 'failed', failureReason: reason.slice(0, 255) })
  }

  /**
   * 事务内锁顺序：先会话行，再草稿行。
   *
   * 业务创建与草稿回执由 Task 9 在同一个事务里提交；会话删除走 `removeByConversation`，
   * 两者都先拿会话行锁，因此删除与提交不可能互相穿插（设计 §9、§11）。
   */
  async withSubmissionLock<T>(ownerId: number, conversationId: string, draftId: string, fn: (tx: ActionDraftTx, draft: ActionDraft) => Promise<T>): Promise<T> {
    return this.store.transaction(async tx => {
      if (!await tx.conversationExists(ownerId, conversationId)) throw aiError(404, '会话不存在')
      const row = await tx.find(ownerId, draftId)
      if (!row || row.conversationId !== conversationId) throw aiError(404, '草稿不存在')
      return fn(tx, row)
    }, { ownerId, conversationId })
  }

  /**
   * 会话删除时清理草稿；有草稿正在提交时拒绝删除。
   *
   * 由 `AiChatService.remove` 在删会话**之前**调用 —— 这个守卫必须活在删除路径上：
   * 表上的 `ON DELETE CASCADE` 不看 `submitting`，一次进行中的用户创建会被它静默删除。
   * 删除事务先锁会话行，与 `withSubmissionLock` 互斥；清理完成后并发的提交会发现
   * 草稿已不存在（404），不会复活。`ON DELETE CASCADE` 予以保留：它是**兜底**，
   * 保证任何未经本方法的会话删除也不会留下孤儿草稿；允许级联的状态由删除路径
   * 的守卫决定，而不是由外键决定。
   */
  async removeConversationDrafts(ownerId: number, conversationId: string): Promise<boolean> {
    await this.store.removeByConversation(ownerId, conversationId)
    return true
  }

  // ---------------------------------------------------------------- 表单

  /**
   * 打开/关闭原生表单时切换 `previewing`。
   *
   * 关闭时不回到某个固定状态，而是按当前值重算：`previewing` 从不代表「字段已合法」。
   */
  async markPreviewing(ownerId: number, draftId: string, draftVersion: number, open = true): Promise<ActionDraft> {
    const row = await this.get(ownerId, draftId)
    if (row.draftVersion !== draftVersion) throw conflict(this.explain(row, draftVersion))
    const evaluation = this.evaluate(row.formData)
    return this.swap(ownerId, row, draftVersion, EDITABLE_ACTION_DRAFT_STATUSES, {
      status: open ? 'previewing' : evaluation.status,
      missingFields: evaluation.missingFields,
      validationErrors: evaluation.validationErrors,
    })
  }

  // ------------------------------------------------------------ 内部规则

  private assertTarget(module: string, action: string): void {
    if (!(ACTION_DRAFT_MODULES as readonly string[]).includes(module) || !(ACTION_DRAFT_ACTIONS as readonly string[]).includes(action)) {
      throw aiError(400, `暂不支持的表单目标：${module} / ${action}`)
    }
  }

  private assertSchemaVersion(schemaVersion?: number): void {
    if (schemaVersion !== undefined && schemaVersion !== USER_CREATE_FORM_SCHEMA_VERSION) {
      // 版本对不上必须重新读表单定义，而不是拿旧字段名继续写（Task 3 契约）。
      throw aiError(400, '表单定义已更新，请重新读取表单后再保存草稿')
    }
  }

  /**
   * 字段白名单与基本类型校验。
   *
   * 与 HTTP schema 同一条规则，但在这里**再执行一次**：模型工具调用不经过 HTTP 层。
   * 未知字段与 `password` 当场拒绝，值本身不合业务格式不在这里判断。
   *
   * `allowNull` 只有补丁为 `true`：保存时 `null` 唯一的含义是「清空这个可选字段」，
   * 入库前会被规范化成**移除**该键。创建路径上的 `null` 没有语义 —— 模型传
   * `{phone:null}` 表示「还没问到手机号」，而不是「手机号为空」—— 一律 400，
   * 否则必填字段会同时是「已清空」和「已收集」，草稿宣称 ready 而提交被拒。
   */
  private normalize(formData: Record<string, unknown>, allowNull: boolean): Record<string, unknown> {
    if (!isPatch(formData)) throw aiError(400, '表单数据格式无效')
    const rejected: string[] = []
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(formData)) {
      if (value === undefined) continue
      if (!EDITABLE_FIELDS.has(key as string)) { rejected.push(key); continue }
      if (value === null) {
        // 创建不接受 null；补丁里 null 是「清空」，由调用方在合并时移除该键。
        if (allowNull) out[key] = null
        else rejected.push(key)
        continue
      }
      if (!matchesDraftFieldType(key as string, value)) { rejected.push(key); continue }
      out[key] = value
    }
    if (rejected.length) throw aiError(400, `不支持的字段：${[...new Set(rejected)].join('、')}`)
    return out
  }

  /** 用真实表单定义算「缺什么、哪里不合法」。值一律原样保留。 */
  private evaluate(formData: Record<string, unknown>) {
    const form = this.form()
    const byName = new Map(form.fields.map(field => [field.name, field]))
    const validationErrors: ActionDraft['validationErrors'] = []
    for (const [name, value] of Object.entries(formData)) {
      if (typeof value !== 'string') continue
      for (const error of checkString(byName.get(name)?.constraints ?? {}, value)) {
        validationErrors.push({ field: name, label: byName.get(name)?.label ?? name, ...error })
      }
    }
    const editable = new Set(form.editableFields)
    const missingFields: ActionDraft['missingFields'] = [
      // 表单里有、但对话不该收集的字段（首期就是 password）：永远要在表单里补齐。
      ...form.missingFields,
      // 真实必填且可编辑的字段，用户还没提供的。
      ...form.fields
        .filter(field => field.required && editable.has(field.name) && !hasValue(formData[field.name]))
        .map(field => ({ name: field.name, label: field.label, required: true, sensitive: false, mustCompleteInForm: false as const })),
    ]
    return { validationErrors, missingFields, status: this.statusOf(missingFields, validationErrors) }
  }

  /**
   * `ready` = 对话该收的都收了，**且当前写下的值没有已知格式错误**。
   *
   * `mustCompleteInForm`（首期就是密码）不参与判定：它永远由最终表单完成，
   * 否则任何草稿都不可能 ready（设计 §9）。它仍然出现在 `missingFields` 里，
   * 因为界面需要据此提示用户。
   *
   * 但 `validationErrors` 参与判定。`ready` 的语义是「模型可以照此提交」，而不是
   * 「字段都出现过」：`{phone:'13', email:'not-an-email'}` 带着两个未解决的格式错误
   * 宣称 ready，等于草稿替提交接口撒了谎，而真正被拒的是用户。值仍然原样保留在
   * `formData` 里，由用户或下一轮工具结果修正后再转 ready。
   */
  private statusOf(missingFields: ActionDraft['missingFields'], validationErrors: ActionDraft['validationErrors']): ActionDraftStatus {
    if (validationErrors.length) return 'collecting'
    return missingFields.some(field => !field.mustCompleteInForm) ? 'collecting' : 'ready'
  }

  /** 纯判断，不读库：把零行 CAS 翻译成一句人话。 */
  private explain(row: ActionDraft, expectedVersion: number): string {
    if (row.status === 'expired' || row.expiresAt.getTime() <= this.now().getTime()) return '草稿已过期，请重新开始填写'
    if (row.status === 'completed') return '草稿已完成，不能再次修改'
    if (row.status === 'cancelled') return '草稿已取消，不能再次修改'
    if (row.status === 'submitting') return '草稿正在提交，请勿重复操作'
    if (row.draftVersion !== expectedVersion) return '草稿版本已更新，请刷新后重试'
    return '草稿当前状态不允许该操作'
  }

  /**
   * compare-and-swap 落地。
   *
   * 零行更新不是「行不存在」，而是谓词（版本 + 状态）没命中：这里重新读一次**归属范围内**
   * 的当前行来解释，仍然读不到才回 404 —— 别人的草稿因此和不存在等价。
   */
  private async swap(
    ownerId: number,
    row: ActionDraft,
    expectedVersion: number,
    allowedStatuses: readonly ActionDraftStatus[],
    patch: Partial<ActionDraft>,
    rejectedMessage?: string,
  ): Promise<ActionDraft> {
    const updated = await this.store.compareAndSwap({ ownerId, draftId: row.draftId, expectedVersion, allowedStatuses, patch })
    if (updated) {
      const fresh = await this.store.find(ownerId, row.draftId)
      return fresh ?? { ...row, ...patch, draftVersion: expectedVersion + 1 }
    }
    const current = await this.store.find(ownerId, row.draftId)
    if (!current) throw aiError(404, '草稿不存在')
    const message = this.explain(current, expectedVersion)
    // 状态本身不允许、且与版本无关时，给出该状态的具体原因（信息缺失 / 已取消 …）。
    if (message === '草稿当前状态不允许该操作' && rejectedMessage) throw conflict(rejectedMessage)
    throw conflict(message)
  }

  /** 把过期行落地为 `expired`；已经结束的行不动。 */
  private async expire(row: ActionDraft) {
    await this.store.compareAndSwap({
      ownerId: row.ownerId,
      draftId: row.draftId,
      expectedVersion: row.draftVersion,
      allowedStatuses: ACTION_DRAFT_STATUSES.filter(status => !['completed', 'cancelled', 'expired'].includes(status)),
      patch: { status: 'expired' },
    })
  }
}

function conflict(message: string) {
  return aiError(409, message)
}

/** 只读校验，返回错误而不修改值 —— 半截手机号因此可以留在草稿里。 */
function checkString(constraints: Record<string, unknown>, value: string): { code: string; message: string }[] {
  const errors: { code: string; message: string }[] = []
  const enumValues = constraints.enum
  if (Array.isArray(enumValues) && !enumValues.includes(value)) errors.push({ code: 'not_in_enum', message: '取值不在允许范围内' })
  const maxLength = constraints.maxLength
  if (typeof maxLength === 'number' && value.length > maxLength) errors.push({ code: 'too_long', message: `长度不能超过 ${maxLength} 个字符` })
  const minLength = constraints.minLength
  if (typeof minLength === 'number' && value.length > 0 && value.length < minLength) errors.push({ code: 'too_short', message: `长度不能少于 ${minLength} 个字符` })
  const pattern = constraints.pattern
  if (typeof pattern === 'string' && value !== '' && !new RegExp(pattern).test(value)) errors.push({ code: 'pattern_mismatch', message: '格式不正确' })
  const format = constraints.format
  if (format === 'email' && value !== '' && !/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(value)) errors.push({ code: 'not_an_email', message: '邮箱格式不正确' })
  if (format === 'date' && value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.push({ code: 'not_a_date', message: '日期格式应为 YYYY-MM-DD' })
  return errors
}

export type { ActionDraftModule, ActionDraftAction }
