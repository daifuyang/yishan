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
export type { SysUserResp, CreateUserReq, UpdateUserReq, UserCreateDraftFields, UserCreateDraftPartial } from './core/schemas/user'
export {
  CreateUserReqSchema,
  UserCreateDraftFieldsSchema,
  UserCreateDraftPartialSchema,
  USER_CREATE_DRAFT_FIELD_KEYS,
} from './core/schemas/user'
// 用户创建的统一授权规则：普通后台新增与 AI 草稿提交共用，不允许各自一份。
export { validateUserCreation, USER_CREATE_PERMISSION } from './core/services/user-creation-policy'
export type { UserCreationSubject, ValidateUserCreationOptions } from './core/services/user-creation-policy'
// 表单元数据与候选查询：AI 能力（Task 6）与只读端点走同一个 service，不内部 HTTP 自调用。
export { UserCreationFormService, USER_CREATE_FORM_SCHEMA_VERSION } from './core/services/user-creation-form.service'
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
