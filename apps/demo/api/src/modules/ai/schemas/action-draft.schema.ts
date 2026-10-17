/**
 * action-draft.schema.ts — AI 业务助手的**持久化草稿**传输契约。
 *
 * 草稿是「用户对着话」填了一半的新建用户表单：它归一个人**且**归一个会话所有，
 * 自创建起 24 小时有效，由 `draft_version` 做乐观并发控制。它是恢复快照，不是第二套
 * 可编辑状态 —— 表单打开后，界面上的值仍以原生表单为准（设计 §6）。
 *
 * 三条刻意的不对称：
 *
 * 1. **键白名单与基本类型从同源字段派生**（`UserCreateDraftFieldsSchema`，Task 2），
 *    但**丢掉业务格式**：草稿要能存下「刚打了一半的手机号」。所以手机号在传输层是
 *    一个普通字符串；是否合法由 Service 用真实业务约束算出 `validationErrors`
 *    并**保留原值**（设计 §7、§9）。让 HTTP schema 因为手机号还没输完就整份拒绝，
 *    等于禁止「边说边填」。
 * 2. **`additionalProperties: false` 是硬边界**：`password` 与任何未登记字段在这里
 *    就被拒，模型、工具与前端都拿不到第二份密码副本的入口（设计 §6、§10）。
 * 3. **PATCH 是显式字段补丁**：`null` 表示「清空这个可选字段」，**省略**表示
 *    「别动它」。两者混为一谈会让助手一次补丁清空半个表单。
 */
import { Type, type Static, type TSchema } from '@sinclair/typebox'
import { USER_CREATE_DRAFT_FIELD_KEYS, UserCreateDraftFieldsSchema } from '@yishan/core-system-api'

/**
 * 草稿状态机。
 *
 * `ready` 表示「对话该收集的信息已齐」，不是「可以提交」——密码等受保护字段仍然
 * 由最终表单校验（设计 §9）。`submitting` 只由 Service 在事务内写入，绝不作为
 * 事务外的租约使用。
 */
export const ACTION_DRAFT_STATUSES = [
  'collecting',
  'ready',
  'previewing',
  'submitting',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const

export type ActionDraftStatus = (typeof ACTION_DRAFT_STATUSES)[number]

/**
 * 允许被对话修改的状态。`failed` 在其中：明确的校验/业务失败必须保留可编辑草稿
 * （设计 §11）。`completed` / `cancelled` / `expired` 不在其中，因此迟到的工具结果
 * 无法重新激活一个已结束的草稿（设计 §9）。
 */
export const EDITABLE_ACTION_DRAFT_STATUSES: readonly ActionDraftStatus[] = ['collecting', 'ready', 'previewing', 'failed']

/**
 * 首期只登记「system / user.create」这一条真实表单契约（设计 §5）。
 *
 * 写成显式白名单而不是自由字符串：模型不能凭草稿接口创建别的模块或别的动作，
 * 新增协作目标必须先在这里登记一个真实存在的表单适配器。
 */
export const ACTION_DRAFT_MODULES = ['system'] as const
export const ACTION_DRAFT_ACTIONS = ['user.create'] as const
export type ActionDraftModule = (typeof ACTION_DRAFT_MODULES)[number]
export type ActionDraftAction = (typeof ACTION_DRAFT_ACTIONS)[number]

/** 有效期自**创建**起算，不因编辑续期（设计 §9）。 */
export const ACTION_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

/** 草稿只保存业务结果的引用，永远不保存密码原文或派生摘要（设计 §11）。 */
export interface ActionDraftResultRef {
  targetType: string
  targetId: string
}

/** 取源字段的「基本类型」，丢掉 enum / pattern / format。 */
function relaxedField(source: unknown): TSchema {
  const schema = (source ?? {}) as { type?: string; items?: { type?: string }; anyOf?: unknown[]; maxLength?: number }
  if (schema.type === 'array') return Type.Array(schema.items?.type === 'string' ? Type.String() : Type.Number())
  // birthDate 之类的联合类型：取第一个成员的原始类型，宽松成单个字符串。
  if (!schema.type && Array.isArray(schema.anyOf)) return relaxedField(schema.anyOf[0])
  return Type.String({ maxLength: schema.maxLength ?? 255 })
}

/**
 * 传输层的 `formData`：**只有键白名单和基本类型是强制的**。
 *
 * 与 `UserCreateDraftFieldsSchema` 的差别只有一处，而且是刻意的：任何字符串约束
 * （enum / pattern / format / minLength）都被去掉。这里拒绝的是「形状不合法」，
 * 不是「业务上还没填对」。
 */
export const ActionDraftFormDataSchema = Type.Object(
  Object.fromEntries(
    USER_CREATE_DRAFT_FIELD_KEYS.map(key => [key, Type.Optional(relaxedField(UserCreateDraftFieldsSchema.properties[key]))]),
  ) as unknown as Record<(typeof USER_CREATE_DRAFT_FIELD_KEYS)[number], TSchema>,
  { $id: 'aiActionDraftFormData', additionalProperties: false },
)

/** 补丁形状与保存形状一致，只是每个值额外允许 `null`（清空）。 */
export const ActionDraftFormDataPatchSchema = Type.Object(
  Object.fromEntries(
    USER_CREATE_DRAFT_FIELD_KEYS.map(key => [key, Type.Optional(Type.Union([relaxedField(UserCreateDraftFieldsSchema.properties[key]), Type.Null()]))]),
  ) as unknown as Record<(typeof USER_CREATE_DRAFT_FIELD_KEYS)[number], TSchema>,
  { $id: 'aiActionDraftFormDataPatch', additionalProperties: false },
)

export type ActionDraftFormData = Static<typeof ActionDraftFormDataSchema>

/**
 * **线上传输**用的 `formData` 容器：字段本身不交给 ajv 判。
 *
 * 契约 schema（上面的 `ActionDraftFormDataSchema` / `ActionDraftFormDataPatchSchema`）
 * 才是真正的形状定义，但它跑在 ajv 上会被两个实例级开关破坏语义：
 * `removeAdditional` 会把 `password` 悄悄删掉，`coerceTypes` 会把补丁里的 `null`
 * （清空可选字段）压成 `""` —— 两者都会让「用户以为存下了」而实际没有。
 * 因此路由用这个宽松容器，形状由 `routes/v1/drafts.ts` 的 preValidation 守卫判定，
 * 与 Service 的 `normalize()` 用同一份白名单。
 */
export const ActionDraftTransportFormDataSchema = Type.Record(Type.String(), Type.Unknown())
/** 重新导出：草稿可写字段就是 Task 2 的同源白名单，不另立一份。 */
export { USER_CREATE_DRAFT_FIELD_KEYS }
export type ActionDraftFormDataPatch = Static<typeof ActionDraftFormDataPatchSchema>

const ModuleSchema = Type.String({ enum: ACTION_DRAFT_MODULES as unknown as string[] })
const ActionSchema = Type.String({ enum: ACTION_DRAFT_ACTIONS as unknown as string[] })
export const ActionDraftStatusSchema = Type.Union(ACTION_DRAFT_STATUSES.map(status => Type.Literal(status)) as never)

export const ActionDraftCreateBodySchema = Type.Object({
  module: ModuleSchema,
  action: ActionSchema,
  formData: ActionDraftFormDataSchema,
  // 可选：模型把上次读到的表单版本带回来。带了就必须对得上，否则必须重新读表单。
  schemaVersion: Type.Optional(Type.Integer({ minimum: 1 })),
}, { $id: 'aiActionDraftCreateBody', additionalProperties: false })

export const ActionDraftPatchBodySchema = Type.Object({
  draftVersion: Type.Integer({ minimum: 1 }),
  formData: ActionDraftFormDataPatchSchema,
}, { $id: 'aiActionDraftPatchBody', additionalProperties: false })

export const ActionDraftCancelBodySchema = Type.Object({
  draftVersion: Type.Integer({ minimum: 1 }),
}, { $id: 'aiActionDraftCancelBody', additionalProperties: false })

/**
 * 路由实际挂载的创建/补丁 body。
 *
 * 与上面的契约 schema 只差 `formData` 的容器：字段形状由 preValidation 守卫 +
 * Service 的 `normalize()` 判定，这样才能保住「`null` 清空」的语义。
 */
export const ActionDraftCreateTransportBodySchema = Type.Object({
  module: ModuleSchema,
  action: ActionSchema,
  formData: ActionDraftTransportFormDataSchema,
  schemaVersion: Type.Optional(Type.Integer({ minimum: 1 })),
}, { $id: 'aiActionDraftCreateTransportBody', additionalProperties: false })

export const ActionDraftPatchTransportBodySchema = Type.Object({
  draftVersion: Type.Integer({ minimum: 1 }),
  formData: ActionDraftTransportFormDataSchema,
}, { $id: 'aiActionDraftPatchTransportBody', additionalProperties: false })

const MissingFieldSchema = Type.Object({
  name: Type.String(),
  label: Type.String(),
  required: Type.Boolean(),
  sensitive: Type.Boolean(),
  mustCompleteInForm: Type.Boolean(),
})

const ValidationErrorSchema = Type.Object({
  field: Type.String(),
  label: Type.String(),
  /** 稳定的机器可读原因；`message` 只给人看。 */
  code: Type.String(),
  message: Type.String(),
})

const ResultRefSchema = Type.Object({ targetType: Type.String(), targetId: Type.String() })

export const ActionDraftSchema = Type.Object({
  draftId: Type.String(),
  ownerId: Type.Integer(),
  conversationId: Type.String(),
  module: ModuleSchema,
  action: ActionSchema,
  schemaVersion: Type.Integer(),
  formData: Type.Record(Type.String(), Type.Unknown()),
  missingFields: Type.Array(MissingFieldSchema),
  validationErrors: Type.Array(ValidationErrorSchema),
  draftVersion: Type.Integer(),
  status: ActionDraftStatusSchema,
  resultRef: Type.Union([ResultRefSchema, Type.Null()]),
  failureReason: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.String({ format: 'date-time' }),
}, { $id: 'aiActionDraft', additionalProperties: false })

/** 路径参数：与会话 id 同一套字符集约束。 */
export const ActionDraftIdParamsSchema = Type.Object({
  draftId: Type.String({ minLength: 1, maxLength: 64, pattern: '^[a-zA-Z0-9_-]+$', description: '草稿 ID' }),
}, { additionalProperties: false })

export type ActionDraftBody = Static<typeof ActionDraftCreateBodySchema>
export type ActionDraftPatchBody = Static<typeof ActionDraftPatchBodySchema>
export type ActionDraftMissingField = Static<typeof MissingFieldSchema>
export type ActionDraftValidationError = Static<typeof ValidationErrorSchema>

function aiEnvelope(data: TSchema) {
  return Type.Object({ success: Type.Boolean(), code: Type.Number(), message: Type.String(), timestamp: Type.String(), data })
}
export const ActionDraftResponseSchema = aiEnvelope(ActionDraftSchema)
export const ActionDraftListResponseSchema = aiEnvelope(Type.Object({ items: Type.Array(ActionDraftSchema) }))
export const ActionDraftOkResponseSchema = aiEnvelope(Type.Object({ ok: Type.Boolean() }))
