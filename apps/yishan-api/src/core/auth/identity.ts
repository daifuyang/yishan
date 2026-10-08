/**
 * identity.ts — 身份与权限来源的最小契约（kernel）。
 *
 * jwt-auth（取 token、验签、PAT 前缀分流）与 rbac（公开权限、活动目录、PAT scope 交集）
 * 是公共机制；“token 对应哪个用户、用户是否可用、用户持有哪些权限”由 AuthProvider 回答。
 * 默认实现是 system 的 `core/services/auth-provider.ts`（sys_user / sys_user_token /
 * sys_api_token / sys_role_permission），在组合根 app.ts 中装饰到 `fastify.authProvider`。
 * 替换身份体系（SSO、外部用户中心）= 提供另一个 AuthProvider，不需要改 jwt-auth、rbac 或模块。
 *
 * 失败约定：
 *   - 返回 null 表示“找不到”（会话已撤销 / PAT 不存在），由 jwt-auth 按调用场景给出标准错误；
 *   - 其余拒绝（用户已删除、禁用、锁定……）由实现直接抛 BusinessError（AuthErrorCode / UserErrorCode）。
 */
import type { FastifyBaseLogger } from 'fastify'

/** 模块可见的最小用户形状。模块只应依赖 `id`（以及鉴权内部使用的 `roleIds`）。 */
export interface Principal {
  id: number
  roleIds?: number[]
}

/**
 * `request.currentUser` 的类型。kernel 只保证 Principal；默认 system 实现通过声明合并
 * 把 sys_user 的字段并入（见 core/services/auth-provider.ts）。替换 system 时删除该合并即可。
 */
export interface CurrentUser extends Principal {}

export type TokenKind = 'access_token' | 'refresh_token'

/** 已验签的 JWT 载荷（@fastify/jwt 解析结果）。 */
export interface JwtClaims {
  id: number
  type?: TokenKind
}

export interface AuthProvider {
  /**
   * JWT 已验签、类型已检查之后调用：确认该 token 对应的会话仍然有效并返回当前用户。
   * 返回 null → 会话不存在或已撤销（jwt-auth 抛 TOKEN_INVALID）。
   */
  resolveSession(input: { token: string; kind: TokenKind; claims: JwtClaims }): Promise<CurrentUser | null>

  /**
   * 可选：解析 PAT（前缀 `yishan_pat_`）。返回 null → API_TOKEN_NOT_FOUND。
   * 未实现时所有 PAT 都视为不存在。`scopes` 会与角色权限求交集（见 rbac）。
   */
  resolveApiToken?(input: {
    token: string
    ip: string | null
    log: FastifyBaseLogger
  }): Promise<{ user: CurrentUser; scopes: string[] } | null>

  /**
   * 当前用户（JWT 路径）持有的权限码集合；可包含超管哨兵 `__super_admin__`。
   * 活动目录过滤与 PAT scope 交集由 rbac 统一处理，实现方不需要关心。
   */
  loadPermissions(user: CurrentUser): Promise<ReadonlySet<string>>
}

declare module 'fastify' {
  interface FastifyInstance {
    /** 身份与权限来源；组合根（app.ts）在注册 jwt-auth / rbac 之前装饰。 */
    authProvider: AuthProvider
  }
  interface FastifyRequest {
    currentUser: CurrentUser
    /** PAT 请求的 scope；JWT / cookie 请求为 undefined。 */
    tokenScope?: string[]
  }
}
