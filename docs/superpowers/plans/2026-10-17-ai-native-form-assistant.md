# AI 原生表单协作实施任务

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Only use superpowers:subagent-driven-development if the user explicitly chooses delegation. Do not start implementation while delivering this plan.

**Goal:** 全局助手随时可唤起，自动打开或填写当前原生新建用户表单，最终由用户点击原有“确定”完成一次可靠创建。

**Architecture:** 复用现有 AI Provider、工具执行链、System 用户表单和创建 API。AI 模块拥有带版本草稿，System 域拥有真实字段及共享授权规则，前端显式接入当前表单。通过组合根注入有限的事务参与接口，使草稿回执与用户创建原子提交，保持模块表和依赖边界。

**Tech Stack:** pnpm 8.15.9、Node >=22、TypeScript、React 19、Ant Design 6、Pro Components、现有 AI SDK 7、Fastify 5、TypeBox、Drizzle/MySQL、Vitest、Jest、现有浏览器验证工具；不升级依赖。

**Spec:** [已批准设计](../specs/2026-10-17-ai-native-form-assistant-design.md)。执行者必须先读设计和 AGENTS.md。

## 全局约束与执行方式

- “主交互是‘全局悬浮助手 + 当前页面感知 + 原生表单协作’。”
- “首期仅注册 `system / user.create`。”
- “表单内部继续拥有开关、表单实例、加载与提交生命周期。”
- “风险声明之外还需审查具体能力实现，不把分类本身当成全部安全保证。”
- “有效期默认自创建起 24 小时，不因每次编辑无限续期。”
- “同一草稿最多完成一次用户创建，提交中的草稿不可编辑。”
- “聊天中的‘直接创建’‘我确认了’不能调用表单 submit 或构造业务创建请求。”
- “不存密码原文或密码派生摘要作为幂等依据。”
- 用户已确认：角色权限码和数据范围不得超过操作者；无法证明包含关系时拒绝。部门按创建权限范围关联，受限必须选范围内部门，仅本人禁止创建，全部范围可不选。
- 禁止跨模块直接读写表、Core 依赖产品、导入私有包路径。API services 不访问具体 drizzleDb；数据库操作归 Repository。
- 工作区已有大量用户改动。开始时记录 git status，复用当前适合的 checkout；不要清理、覆盖或顺带提交其他改动。每项仅提交自己的明确文件和改动片段。
- 本计划是一个闭环的顺序任务，不创建新的聊天、不部署、不向现有业务数据库自动应用迁移。集成测试只使用现有保护机制建立的可丢弃测试数据库。
- 每项遵循：写行为测试 → 确认失败原因 → 最小实现 → 聚焦测试通过 → 检查边界与差异 → 单独提交。后文代码是需实现的接口/核心算法及测试断言，不是可替换仓库模式的通用模板。

## 文件归属与接口约定

| 位置 | 职责 |
| --- | --- |
| `packages/core/system-api/src/core/services/user-creation-policy.ts`（新） | 用户创建、角色授予及部门关联规则，复用现有权限/范围解析 |
| `packages/core/system-api/src/core/schemas/user.ts`（改） | 导出真实创建 Schema、非敏感草稿字段 Schema、候选/表单定义契约 |
| `packages/core/system-api/src/core/services/user-creation.ts`（新） | 公开、窄范围的创建事务参与接口；不引入通用动作引擎 |
| `packages/core/system-api/src/core/services/user.service.ts`、相关 Repository（改） | 共享校验、创建事务、提交后缓存与通知 |
| `apps/demo/api/src/modules/ai/{schemas,services,repositories}`（新草稿文件） | 归属、版本、恢复、生命周期及事务回执 |
| `apps/demo/api/src/app.ts`（改） | 将 AI 草稿事务参与者注入 SystemRuntime，卸载 AI 时不注入 |
| `packages/core/system-admin/src/form-assistance/index.ts`（新） | 原生表单协作的公开前端契约及生命周期；不依赖产品助手 |
| `packages/core/system-admin/src/pages/user/`（改） | 同一原生 UserForm 接收人工/AI 打开入口与字段补丁 |
| `apps/demo/admin/src/modules/ai/`（改） | 草稿工具结果、当前目标、原生表单桥接和悬浮交互 |

所有新增文件在对应任务中列出；只有真实独立逻辑才拆文件，不新增空目录或逐页服务。System Admin 没有独立 test 脚本，组件行为测试放到现有 Demo Admin Jest 测试工程，通过公开导出测试。

## Task 1：强制隔离模型工具与业务写操作

**文件：** 修改 `packages/core/api/src/ai-capability-catalog.ts`、`apps/demo/api/src/modules/ai/services/ai-execution-chain.ts`；扩展 `apps/demo/api/src/modules/ai/tests/ai-execution-chain.test.ts`。参考现有能力注册测试，不增加另一份注册中心。

**接口：** 保留 `AiCapability` 的风险类型，当前供模型使用的 Catalog.register 拒绝 write/sensitive；listFor 和 executeCapability 再次拒绝非 read/prepare。人工提交不进入此 Catalog。

- [ ] 添加注册拒绝测试，并在执行链测试中通过替身模拟违规能力绕过注册，确保业务 execute 未调用且记录 denied 审计。

```ts
expect(() => catalog.register(writeCapability)).toThrow();
const result = await executeCapability(request, 'create_user', {});
expect(result.ok).toBe(false);
expect(writeCapability.execute).not.toHaveBeenCalled();
```

- [ ] 运行 `pnpm --filter @yishan/demo-api test src/modules/ai/tests/ai-execution-chain.test.ts`，确认现有代码不能满足上述限制。
- [ ] 在注册、清单和执行入口使用相同条件：`riskLevel === 'read' || riskLevel === 'prepare'`；执行拒绝复用现有审计，不增加用户可覆盖的“确认”参数。
- [ ] 重跑聚焦测试及现有 `ai-data-scope.test.ts`，确认 read/prepare、PAT、模块开关和权限回收路径正常。
- [ ] 提交：`fix(ai): enforce read and prepare tool boundary`。

## Task 2：同源用户字段定义与创建授权规则

**文件：** 新建 `packages/core/system-api/src/core/services/user-creation-policy.ts`、`packages/core/system-api/test/user-creation-policy.test.ts`；修改 `core/schemas/user.ts`、`core/services/user.service.ts`、`core/auth/data-scope.ts`、`core/repositories/{permission,role,dept,user}.repository.ts` 和公共 exports（均在 `packages/core/system-api` 内）。先读这些具体文件和现有 `test/data-scope.test.ts`、`test/user.service.test.ts`。

**接口：** 导出真实 `CreateUserReqSchema`，使用 Type.Omit 排除 password、draftSubmission，再按 UserForm 实际字段白名单取字段，得到 `UserCreateDraftFieldsSchema` 与 `UserCreateDraftFields`；草稿取 Type.Partial，允许逐轮补齐。头像等现有可写但不在表单的字段不自动开放给助手。

```ts
export type UserCreationSubject = {
  actorId: number;
  tokenScope?: readonly string[];
};
// actor 的角色/部门由服务端重新加载，不接受模型传入。
export async function validateUserCreation(
  subject: UserCreationSubject,
  fields: UserCreateDraftFields,
): Promise<void>;
```

- [ ] 添加测试：全部/本部门/子部门/自定义/仅本人；多选部门含一个越权即拒绝；未知或禁用部门拒绝；role 权限码子集、范围扩大、组合授予、超管角色、PAT 收窄、角色禁用及权限回收。
- [ ] 为同源规则添加断言：用户名/姓名可选；phone/password 必填；草稿不能接收 password；手机号和密码在原生表单/API 的合法与非法样例一致。先读取既有手机号数据和测试，沿用产品契约，不擅自仅接受中国大陆号码。
- [ ] 运行 `pnpm --filter @yishan/core-system-api exec vitest run test/user-creation-policy.test.ts test/user.service.test.ts`，确认新增规则失败。
- [ ] 实现最小规则：服务端读取操作者最新角色、部门及权限，权限加载不使用 30 秒旧缓存（采用现有 `ttlMs: 0` 能力），用已有范围解析按每个权限分别比较。目标范围根据拟关联部门与所选角色组合计算；仅本人是“主体自身”语义，不把两个不同 userId 当同一对象，也不因新用户 ID 尚未生成而默认为全部。无法证明包含关系则拒绝。
- [ ] 将 validateUserCreation 接到现有 createUser 路径，保留 validateUser 扩展、密码、唯一性和通知逻辑。Repository 新增查询接受现有 db/test 注入模式，Service 不执行 SQL。
- [ ] 重跑 Task 2 聚焦测试和 data-scope 测试；旧测试若假设无限制分配，改成新批准规则并明确理由，不放宽生产代码迁就旧断言。
- [ ] 提交：`feat(system): enforce shared user creation authorization`。

## Task 3：供原生表单和助手共用的字段与候选接口

**文件：** 修改 `packages/core/system-api/src/core/routes/api/v1/admin/users/index.ts`、`core/schemas/user.ts`、`core/ai/system-capabilities.ts`、`packages/core/system-api/src/index.ts`；新建 `packages/core/system-api/test/user-creation-routes.test.ts`。

**接口：** 在既有用户资源下增加只读端点，均使用 `system:user:create`：

```text
GET /api/v1/admin/user/create-form
  operationId: getUserCreateForm
  data: { schemaVersion, fields, defaults, editableFields, missingFields }
GET /api/v1/admin/user/create-options
  operationId: getUserCreateOptions
  query: { keyword?, deptIds?: number[], page?, pageSize? }
  data: { departments: 树节点[], roles: {id,name}[], total, page, pageSize }
```

`create-form` 返回字段名/标签/必填/约束/敏感属性及选择器标识，约束来自真实 Schema，不能返回任意可执行渲染代码。role 选项按候选 deptIds 及 Task 2 策略计算，服务端最终验证仍不可省略。缺失敏感字段仅标记需要在表单完成，不要求对话收集。

- [ ] 写路由测试：401/403、PAT、超管、过滤后的部门树、角色名称重名、分页、deptIds 变化重新计算角色、拒绝伪造字段编辑能力。配置树返回结构沿用原有部门树，不另造树模型。
- [ ] 运行 `pnpm --filter @yishan/core-system-api exec vitest run test/user-creation-routes.test.ts`，确认端点与过滤尚未实现。
- [ ] 用 Task 2 共享规则实现查询；固定路径避免被 `/:id` 参数路由误接收，注册方式复用 createRouteRegistrar。模型的查询能力调用相同服务，而不是内部 HTTP 调用或另查表。
- [ ] 重跑 Task 2/3 测试，确认原有用户 CRUD 路径和权限码保持兼容。
- [ ] 提交：`feat(system): expose authorized user creation form metadata`。

## Task 4：持久化草稿、版本与恢复接口

**文件：** 新建 AI 模块 `schemas/action-draft.schema.ts`、`repositories/action-draft.repository.ts`、`services/action-draft.service.ts`、`routes/v1/drafts.ts`、`tests/action-draft.test.ts`、`tests/action-draft-routes.test.ts`；修改 `db/schema.ts`、`services/ai-chat.service.ts`、迁移账本；新增 `drizzle/0002_action_drafts.sql`。目录均位于 `apps/demo/api/src/modules/ai/`。

**接口：** TypeBox 定义全部状态及响应；`formData` 仅允许 Task 2 非敏感字段，不允许任意对象。草稿传输 Schema 按同源字段派生键白名单和基本数据类型；允许暂时不符合业务格式的字符串，Service 用真实业务约束生成 validationErrors 并保留原值。不能让 HTTP Schema 在保存错误手机号前直接拒绝整个草稿；密码、未知字段及错误基本类型仍拒绝。

```ts
// 部分接口示意，返回类型由同文件 TypeBox Schema 推导。
class ActionDraftService {
  create(ownerId: number, conversationId: string, fields: UserCreateDraftFields): Promise<ActionDraft>;
  get(ownerId: number, draftId: string): Promise<ActionDraft>;
  patch(ownerId: number, draftId: string, version: number, fields: Partial<UserCreateDraftFields>): Promise<ActionDraft>;
  cancel(ownerId: number, draftId: string, version: number): Promise<ActionDraft>;
}
```

`ActionDraft` 保存设计要求的字段、ownerId 和创建/更新时间；成功仅保存结果引用。PATCH 以显式字段补丁合并，支持用 null 清空可选字段（入库前规范化为字段移除）；不得把省略字段当作清空。

```text
POST /api/ai/v1/conversations/:id/drafts  { module:'system', action:'user.create', formData }
GET /api/ai/v1/conversations/:id/drafts
GET /api/ai/v1/drafts/:draftId
PATCH /api/ai/v1/drafts/:draftId          { draftVersion, formData }
POST /api/ai/v1/drafts/:draftId/cancel    { draftVersion }
```

- [ ] 测试归属、跨会话伪造、24 小时有效期、schemaVersion 不匹配、版本冲突、字段清空、缺失项、校验错误、完成/取消不可激活、密码拒绝、会话删除与提交冲突。采用注入时钟及 store，避免测试等待真实过期。
- [ ] 运行 `pnpm --filter @yishan/demo-api test src/modules/ai/tests/action-draft`，确认缺少实现。
- [ ] 实现 Repository 的 owner+conversation 条件和 compare-and-swap：`UPDATE ... WHERE draft_version = expected AND status IN (...)`；影响行数为零必须区分不可见、冲突或过期，外部不泄露他人草稿存在性。
- [ ] 在 Repository 中建事务处理会话删除与提交互斥，约定并发锁顺序：先会话行，再草稿行。表外键/索引沿用本模块迁移风格；不修改已发布迁移/hash。
- [ ] Service 使用 Task 2/3 的真实定义，返回结构化 missingFields/validationErrors。业务格式错误保留原值与错误，未知字段和密码立即拒绝；可编辑失败草稿再次变为 collecting/ready/previewing。
- [ ] 重跑草稿与会话测试；检查迁移 SQL 和账本一致性；此项不对业务数据库应用迁移。
- [ ] 提交：`feat(ai): persist versioned user creation drafts`。

## Task 5：原有创建 API 的草稿关联与原子幂等

**文件：** 新建 `packages/core/system-api/src/core/services/user-creation.ts`、`packages/core/system-api/test/user-creation-transaction.test.ts`、`apps/demo/api/src/modules/ai/services/user-creation-participant.ts`；修改 System API `runtime.ts`、`core/{schemas/user,services/user.service,repositories/user.repository,routes/api/v1/admin/users/index}.ts`、公共 exports；修改 Demo API `src/app.ts`、Task 4 Repository 及审计 Repository。测试增加 AI `tests/user-creation-participant.test.ts`。

**接口：** 由 System API 公共导出事务参与契约；不放进无后端依赖的 contracts 包，不暴露为模型能力。

```ts
export type DraftSubmission = { draftId: string; draftVersion: number };
export interface UserCreationParticipant {
  claim(tx: AppTx, actorId: number, submission: DraftSubmission): Promise<
    | { kind: 'create'; fields: UserCreateDraftFields }
    | { kind: 'replay'; userId: number }
  >;
  complete(tx: AppTx, actorId: number, submission: DraftSubmission, user: SysUserResp): Promise<void>;
}
```

SystemRuntimeOptions 增加可选 `userCreationParticipant`，只由产品组合根在 AI 模块安装时注入；提供 submission 但无参与者时拒绝，不能降级成普通创建。原有 createUser 请求 Schema 增加可选 `draftSubmission`，不把它传入用户字段或模型 Schema。

- [ ] 写测试：同草稿同版本并发只创建一次；不同版本 409；提交数据与服务端草稿不同拒绝；claim/complete/审计失败回滚；业务失败保留草稿；响应序列化或缓存/通知失败不触发第二次创建；无参与者拒绝。
- [ ] 运行 System `test/user-creation-transaction.test.ts` 和 AI `tests/user-creation-participant.test.ts`，确认现状不满足原子回执。
- [ ] 给 UserRepository 增加带注入的事务回调入口（保留 `createInTransaction` 普通调用兼容），Service 只调用 Repository，不访问具体 drizzleDb。服务在事务回调中通过参与者 claim 锁会话/草稿，校验版本后使用持久化字段；请求中的非敏感字段必须规范化后相同，密码仅用于本次创建。
- [ ] 创建权限每次重新判断，Task 2 的规则、唯一性及字段校验在最终创建时执行。需要事务一致的查询接受 tx，由 Repository 执行。成功调用 complete 写草稿结果与成功审计，commit 后才刷新缓存和发通知。
- [ ] replay 在同一认证归属和当前创建权限检查后，以已验证回执指向的 userId 读取既有创建结果，不能将此入口变成任意 ID 查询；不要求额外用户列表权限。已删除结果返回明确的已完成状态，不能再创建。
- [ ] 提交期间不在事务外永久写 submitting 租约：行锁保证并发互斥，只有完整事务可提交 completed。锁等待返回可重查提示；业务明确失败以版本条件记录 failed，不能覆盖其他请求刚完成的 completed；进程崩溃由数据库回滚，不凭内存猜测结果。
- [ ] 重跑聚焦测试及原有 user.service、用户生命周期测试；Task 10 另以真实数据库验证并发和回滚。
- [ ] 提交：`feat(system): atomically complete draft-backed user creation`。

## Task 6：AI 多轮收集与结构化草稿结果

**文件：** 修改 AI 模块 `services/ai-chat.service.ts`、`services/ai-execution-chain.ts`、`schemas/ai-chat.schema.ts`、`runtime/ai-sdk.mts`、`services/ai-intent-router.ts`、`module.ts`；新建 `capabilities/action-drafts.ts`、`tests/action-draft-tools.test.ts`；修改 System `core/ai/system-capabilities.ts` 和 Core API 的 `AiCapabilityContext`。

**接口：** 能力执行上下文增加服务端注入的 conversationId；draftId 和版本仍须归属检查。System 只提供字段/候选 read 能力，AI 模块的 prepare 能力负责持久化草稿，保持 System 不依赖 AI。

```text
get_user_create_form           read     system:user:create
get_user_create_options        read     system:user:create
prepare_create_user            prepare  system:user:create
update_action_draft            prepare  system:user:create
get_action_draft               read     system:user:create
```

将旧 `prepare_create_user` 的注册迁移为单一实现，不保留同名双重注册。返回 `render: { kind:'action.draft', payload:{draftId, draftVersion, uiRequestId} }`；模型只得到非敏感字段、缺失项和错误。UI 事件另带本轮请求与表单上下文引用，后者不构成授权。

- [ ] 测试完整字段、部分字段、跨轮合并、不重复追问、手填请求、重名候选、跳过确认的诱导、伪造 actor、password 字段拒绝、取消/完成后迟到工具不复活、已撤权工具失败。
- [ ] 运行 `pnpm --filter @yishan/demo-api test src/modules/ai/tests/action-draft-tools.test.ts src/modules/ai/tests/ai-intent-router.test.ts`。
- [ ] 用当前执行环境绑定 ActionDraftService；工具身份、会话来自服务端，schemaVersion 和字段可写性来自 Task 3，不信任模型提交的定义。
- [ ] 更新提示词为“原生表单协助”，仅问实际缺失非敏感项；指明密码在表单完成。更新直答分支，不能绕过草稿、权限或真实工具执行。历史上下文中注入本会话当前草稿的最新非敏感摘要，避免只读取旧工具结果。
- [ ] 确认 UIMessage 对扩展结构能保存和恢复；若引入 data part，同步修改 validateUIMessages 的定义及测试，不只修改渲染端。
- [ ] 重跑 AI 聚焦测试，包括 ai-sdk-runtime、ai-chat-repository、ai-execution-chain。
- [ ] 提交：`feat(ai): collect native user form drafts across turns`。

## Task 7：当前表单协作契约与单个原生 UserForm

**文件：** 新建 `packages/core/system-admin/src/form-assistance/index.ts`，增加 package.json 公共 export；修改 `pages/user/index.tsx`、`pages/user/components/UserForm.tsx`、`components/AiPrefillGate/index.tsx`、`ai-prefill/index.ts`；新建 `apps/demo/admin/tests/user-form-assistance.test.tsx`。

**接口：** System Admin 仅定义有限协作能力，不导入 Demo AI；沿用现有显式订阅模式，不引入全局状态库。

```ts
export type UserFormSnapshot = {
  target: 'user.create'; instanceId: string; revision: number;
  fields: UserCreateDraftFields; dirtyFields: readonly string[];
};
export interface UserCreateFormHandle {
  snapshot(): UserFormSnapshot;
  open(): Promise<UserFormSnapshot>;
  apply(input: {
    instanceId: string; baseRevision: number;
    fields: Partial<UserCreateDraftFields>;
  }): Promise<{ applied: boolean; conflicts: readonly string[] }>;
}
```

前端 UserCreateDraftFields 使用生成的公开类型；不得从后端运行时导入。契约不包含 submit、密码、form 实例、setOpen 或 loading。注册返回注销函数，身份清理时清空引用。

- [ ] 测试手动新建后助手只操作同一实例；无表单时 open 创建一次；revision 不符、实例关闭、编辑用户表单不匹配时拒绝；snapshot 永远没有 password；手改字段覆盖需确认；非目标字段保持。
- [ ] 运行 `pnpm --filter @yishan/demo-admin test --runInBand tests/user-form-assistance.test.tsx`，确认契约缺失或存在双开路径。
- [ ] 复用 UserForm 内部生命周期，用严格 FormInstance/ProFormInstance 及真实请求类型替换受影响的 any；只处理本次触及的代码。手动按钮和协作 open 都进入同一 UserForm，移除用户创建场景中 Gate 另挂一个表单的路径；保留部门/用户更新既有预填行为。
- [ ] 用户表单改用 Task 3 同源约束和候选接口；deptIds 变化后重新验证角色，不静默替用户选择。不能编辑的字段 disabled/不显示，并在补丁入口拒绝；服务器仍再检查。
- [ ] 字段来源和 revision 由表单维护；明确字段修改通过用户本轮请求允许，非明确覆盖展示差异确认。同步字段补丁前检查 revision，防止确认期间又被手改覆盖。
- [ ] 重跑新测试及现有 system-package、AiToolResultCard 测试，运行 `pnpm check:boundaries`。
- [ ] 提交：`feat(admin): expose native user form assistance`。

## Task 8：助手与 Modal/Drawer 的可点击、焦点和移动

**文件：** 修改 `apps/demo/admin/src/modules/ai/{AiChatHost,floating/AiFloatingLauncher,floating/AiFloatingPanel,components/AiChatView}.tsx`；在 Task 7 契约中增加参与表单的浮层容器/焦点协作信息；必要时只调整 UserForm 的 Modal 配置。新建 `apps/demo/admin/src/modules/ai/__tests__/aiAssistantOverlay.test.tsx`。

**接口：** 统一定义助手入口、面板及子弹层的层级和挂载位置；表单参与方声明可访问助手区域。助手是非模态浮窗，不能添加第二层全页遮罩。

- [ ] 先做一个最小真实浏览器探针：打开当前 UserForm Modal，再尝试点击助手、输入、Tab/Shift+Tab、Esc 与角色下拉。确认当前失败是层级、焦点捕获还是两者；记录现有 Ant Design 支持的配置，禁止全局关闭所有 Modal 焦点保护。
- [ ] 写组件测试：始终显示授权入口；关闭浮窗保留表单与焦点返回目标；Esc 不双重关闭；拖动仅标题栏生效、限制可视范围、窗口 resize 后不移出屏幕；身份变化清理拖动和焦点引用。
- [ ] 运行 `pnpm --filter @yishan/demo-admin test --runInBand src/modules/ai/__tests__/aiAssistantOverlay.test.tsx`。
- [ ] 使用现有 Portal/浮层方式把层级提升到项目业务弹层之上，并将子弹层挂载到合适容器。对参与协作的表单实现两个区域的焦点协调；全屏助手返回浮窗后仍是同一会话。
- [ ] 在真实浏览器重复第一步，确认业务表单和助手均可输入、下拉选项可点击、未保存数据保留、窄屏可收起面板。JSDOM 不能替代焦点和遮罩验证。
- [ ] 提交：`feat(admin): keep assistant accessible above business overlays`。

## Task 9：串起自动填表、草稿恢复与人工提交

**文件：** 新建 Demo AI `components/AiNativeFormBridge.tsx`、`services/actionDraftService.ts`、`__tests__/aiNativeFormFlow.test.tsx`；修改 `context/AiChatProvider.tsx`、`components/AiToolResultCard.tsx`、`adapters/messages.ts`、`services/aiChatService.ts`、Demo Admin `src/app.tsx`；修改 UserForm 的草稿关联保存。客户端由 Task 10 生成后改用真实类型。

**接口：** Bridge 消费 `action.draft` 结果与 Task 7 公共句柄，负责当前活动请求的 UI 去重。Provider 只加必要的上下文引用和身份 epoch，不另建表单状态树。

```ts
type FormUiRequest = {
  uiRequestId: string;
  draftId: string;
  draftVersion: number;
  identityEpoch: number;
  instanceId?: string;
  baseRevision?: number;
};
```

网络客户端只允许草稿 GET/POST/PATCH/cancel；不提供供模型或 Bridge 调用的 createUser。真正 createUser 仍只在 UserForm 的人工 onFinish 执行。

- [ ] 写行为测试：本轮生成结果自动开表单；历史重放/刷新仅提示继续、不自动弹；用户手动打开时直接填当前实例；旧身份、旧 revision、已关表单的结果不套用；不支持页面明确说明；未保存编辑阻止自动导航。
- [ ] 写提交测试：onFinish 先校验并等待非敏感字段同步，再携带精确 draftSubmission 调用一次原有 createUser；双击被本地锁挡住；失败保留数据和密码控件；成功清理密码、关闭、列表 reload 并显示真实结果；网络异常只查询草稿、不自动重新 POST 创建。
- [ ] 运行 `pnpm --filter @yishan/demo-admin test --runInBand src/modules/ai/__tests__/aiNativeFormFlow.test.tsx`。
- [ ] 实现字段变更短延迟合并同步，并在下一轮 send 和人工提交前 flush；冲突保留本地字段并要求核对。密码不参与 onValuesChange 的同步负载。
- [ ] 自动动作只消费本轮活动 stream 的一次 uiRequestId，历史 tool part 渲染无副作用。用户点“继续填写”时才恢复服务器最新草稿；取消后的恢复不自动新建替代草稿。
- [ ] 卡片只显示当前协助目标、缺失项/错误、继续填写及真实结果，不渲染第二个完整表单。表单打开时全屏切浮窗，身份退出时清理所有协作引用。
- [ ] 重跑现有 aiChat、aiToolResults、AiToolResultCard 及新测试，检查所有创建网络调用仅从人工表单处理器发起。
- [ ] 提交：`feat(ai): connect conversation drafts to native user forms`。

## Task 10：真实数据库、浏览器、契约与交付

**文件：** 新建 `apps/demo/api/test/integration/ai-user-creation.test.ts`；修改现有 product 集成测试时仅抽取确实复用的 disposable database fixture，不复制其中全部业务断言；修改 AI 模块 README、`docs/engineering/ai-chat.md`；新增 `docs/verification/2026-10-17-ai-native-form-assistant.md`。生成更新 `apps/demo/api/openapi.json`、Demo Admin 与 System Admin 的相关 generated 客户端及 typings。

- [ ] 集成测试使用现有编译产物加载方式与 `yishan_demo_test_<随机值>` 可丢弃数据库保护：应用迁移两次，验证新迁移幂等，再调用真实认证路由和创建 API。
- [ ] 用两个独立 app 实例/数据库连接并发提交同一草稿，断言 sys_user 只增加一行、草稿同一结果 ID、审计成功一次；注入 complete 失败确认用户与草稿成功状态一并回滚。不得使用内存锁替代数据库约束。

```ts
const responses = await Promise.all([submitFromAppA(), submitFromAppB()]);
expect(await countUsersByTestPhone()).toBe(1);
expect(await completedResultId()).toBe(await createdUserId());
expect(await successfulDraftAuditCount()).toBe(1);
```

上述测试辅助函数在本测试文件内实现：submitFromAppA/B 调真实 app.inject 的用户创建 API；countUsersByTestPhone/createdUserId 用测试库连接只查询本次唯一手机号；completedResultId/successfulDraftAuditCount 只查询本次 draftId。沿用 product 测试认证与 seed，不硬编码令牌。

- [ ] 增加响应丢失、进程/连接在事务内断开、同一版本重放、版本冲突、角色/权限提交前回收、仅本人禁止创建、跨 owner、过期、取消、会话删除竞争测试；所有失败断言同时检查“没有新增用户”。
- [ ] 运行 `pnpm build:api` 和 `pnpm --filter @yishan/demo-api test:integration`，再跑 `pnpm --filter @yishan/core-system-api test:integration`；记录实际通过/失败/不可用，skip 不能报告为真实数据库通过。
- [ ] 运行 `pnpm --filter @yishan/demo-api openapi:dump`、`pnpm --filter @yishan/demo-admin openapi`、`pnpm check:openapi`。检查生成结果同时包括字段、候选、草稿及可选 draftSubmission；提交 typings 与 client，不手工修补生成类型。
- [ ] 真实浏览器按设计验收 A–H，并增加：手动先开弹窗、浮层始终可用、焦点与下拉、手改覆盖冲突、页面切换迟到结果、刷新主动恢复、关闭助手保留表单。记录请求次数及真实用户 ID；测试替身的模型不能冒充真实模型联调。
- [ ] 运行最终检查：

```text
pnpm --filter @yishan/demo-admin lint
pnpm typecheck:admin
pnpm --filter @yishan/demo-admin test --runInBand
pnpm build:admin
pnpm test:api
pnpm check:boundaries
pnpm lint
pnpm test
pnpm build
```

根命令已包含的重复检查在最终同一版本通过后不无故重复；某步失败先判断是否本次引入，记录已有问题，不修改无关代码。任务跨 apps 和共享 System 行为，最终需要仓库级门禁结果。

- [ ] 更新工程文档：安装/卸载、24 小时草稿、人工恢复、密码不恢复、权限兼容影响、显式迁移步骤、幂等及失败诊断；不写任何凭据。验证文档附 A–H 结果、实际命令、浏览器证据路径和未完成项。
- [ ] 使用 requesting-code-review / verification-before-completion 技能检查实现，确认代码证据后才宣称完成；不自动部署、合并或应用到现有业务数据库。
- [ ] 提交：`test(ai): verify native user creation assistance end to end`。

## 交付检查点

| 检查点 | 已完成任务 | 可审阅的结果 |
| --- | --- | --- |
| 1：业务边界 | 1–3 | 模型无法写业务；普通后台与助手的字段、部门和角色授权同源 |
| 2：服务端闭环 | 4–6 | 多轮持久化草稿、原有创建 API、原子回执及只读工具链 |
| 3：可操作界面 | 7–9 | 同一原生表单、助手常驻可唤起、自动预填、人工提交及恢复 |
| 4：完成验收 | 10 | 真实数据库与浏览器证据、生成客户端、实际门禁和交付说明 |

## 设计覆盖自检

- 原生表单与全局体验：Tasks 7–9；不另建聊天完整表单。
- 字段来源、密码隔离、未知字段、版本与迟到结果：Tasks 2、4、6、7、9。
- 角色权限与数据范围、部门范围、PAT、提交前最新校验：Tasks 2、3、5、10。
- 草稿归属、会话关联、有效期、状态、取消和恢复：Tasks 4、6、9、10。
- 工具注册/清单/执行隔离与提示词：Tasks 1、6。
- 原有 API、事务、防重复、失败保留、真实审计与通知：Tasks 5、9、10。
- 浮窗和业务弹窗共存、键盘、子弹层、拖动：Task 8，真实浏览器在 Task 10 再验收。
- 跨模块边界、迁移、生成客户端、A–H 与实际验证记录：Tasks 4、5、7、10。

本计划已完成任务拆解和自审；所有实施复选框均未开始。设计评审已获用户批准，后续执行按检查点汇报，不对已批准规则重复请求确认。
