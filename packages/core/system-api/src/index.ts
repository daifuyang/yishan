export { createSystemRuntime, currentSystemRuntime, SystemRuntime } from './runtime'
export type { SystemRuntimeOptions } from './runtime'
export { createSystemConfig } from './config/create'
export type { SystemConfig } from './config/create'
export { systemModule } from './module'
export { computeEffectivePerms, hasPermission, SUPER_ADMIN_BYPASS } from './core/auth/effective-permissions'
export { PermissionService } from './core/services/permission.service'
// 行级数据范围：AI 能力执行与 REST 共用同一套建立入口。
export { establishDataScopeFor, currentDataScope, isDataScopeBypassed, type DataScopeIdentity, type DataScopeSubject, type DataScopeFilter } from './core/auth'
export { userDirectory, users } from './users'
export type { SysUserResp, CreateUserReq, UpdateUserReq, UserCreateDraftFields, UserCreateDraftPartial, CreateUserFieldsReq, DraftSubmissionReq } from './core/schemas/user'
export {
  CreateUserReqSchema,
  UserCreateDraftFieldsSchema,
  UserCreateDraftPartialSchema,
  USER_CREATE_DRAFT_FIELD_KEYS,
} from './core/schemas/user'
// 草稿关联创建的事务参与契约。只由产品组合根注入；不放进 contracts（无后端依赖），
// 也不作为模型能力暴露。见 core/services/user-creation.ts 的边界说明。
export { mergeDraftFields } from './core/services/user-creation'
export type {
  UserCreationParticipant,
  DraftSubmission,
  DraftSubmissionFailure,
  DraftResultRef,
} from './core/services/user-creation'
// 用户创建的统一授权规则：普通后台新增与 AI 草稿提交共用，不允许各自一份。
export { validateUserCreation, resolveCreatableDeptScope, USER_CREATE_PERMISSION } from './core/services/user-creation-policy'
export type { UserCreationSubject, ValidateUserCreationOptions, CreatableDeptScope } from './core/services/user-creation-policy'
// 表单元数据与候选查询：AI 能力（Task 6）与只读端点走同一个 service，不内部 HTTP 自调用。
export { UserCreationFormService, USER_CREATE_FORM_SCHEMA_VERSION } from './core/services/user-creation-form.service'
// 新增用户表单的只读能力定义：装配层（setup.ts）与 AI 模块的测试都从这里取，
// 保证「注册的那份」与「断言的那份」不会分叉。
export { systemCapabilitiesForUserCreation } from './core/ai/system-capabilities'
// 用户可写文本进入模型上下文前的中性化：投影白名单 + 加引号 + 剔除结构符号。
// 草稿上下文（产品侧）与系统域候选能力共用同一份实现，避免两份「看起来一样」的规则。
export { asUntrustedData, untrustedRow, untrustedRows } from './core/ai/untrusted-text'
export type {
  UserCreateForm,
  UserCreateFormField,
  UserCreateFormMissingField,
  UserCreateOptions,
  UserCreateOptionsQuery,
  UserCreateOption,
  ListUserCreateOptions,
} from './core/services/user-creation-form.service'
export { EnumService } from './core/services/enum.service'
export { AttachmentService } from './core/services/attachment.service'
export { SystemOptionService } from './core/services/system-option.service'
export { StorageConfigService } from './core/services/storage-config.service'
export { seedSystem, finalizeSystemSeed, seedModuleMenus, seedModuleAppMenus, seedModuleEnums, resolveSeedActor, purgeModuleSeedDeclarations } from './scripts/seed'
export type { MenuSeedNode } from './scripts/seed/config'
export type { ModuleMenuSeedOptions } from './scripts/seed'
export type { SystemFastifyInstance } from './fastify-types'
export type { InstalledModule } from './module-administration'
