/**
 * data-scope.ts — 把当前请求的身份绑进行级数据权限上下文。
 *
 * 与 rbac 的关系：rbac 决定「能不能调这个接口」（垂直权限），本插件决定
 * 「能看到哪些行」（水平权限）。两者互不替代——持有 `system:user:list` 只能说明
 * 能进列表接口，进去之后能看到谁由这里决定。
 *
 * ## 顺序（此前是错的）
 *
 * 旧实现用 `fastify.addHook('preHandler')` 在根实例上建上下文。Fastify 的钩子顺序是
 * **实例级 preHandler 先于路由级 preHandler**，而 `authenticate` / `requirePermission`
 * 都是路由级（见 `createRouteRegistrar`），于是本插件运行时 `request.currentUser`
 * 永远是 undefined → 跳过 → repository 读到 null 上下文 → 不过滤。整条链静默失效。
 *
 * 现在改为由 `createRouteRegistrar` 在 `[authenticate, requirePermission]` **之后**追加
 * 本装饰器，顺序固定为：
 *
 *   认证 → 当前操作权限校验 → 建立数据范围上下文 → 业务处理
 *
 * `permissionCode` 直接取路由声明的 `access.permission.code`，因此范围永远按
 * 「本次操作」的权限计算，而不是按用户手上权限最大的那个接口计算。
 *
 * AI 能力走同一个 `establishDataScopeFor`，共享同一套范围实现。
 */

import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify'
import { PermissionService } from '../../services/permission.service.js'
import { computeEffectivePerms, SUPER_ADMIN_BYPASS } from '../../auth/effective-permissions.js'
import { PERMISSION_CODES } from '@yishan/core-api/permissions/catalog'
import { runWithDataScope, type DataScopeSubject } from '../../auth/data-scope.js'
import type { SysUserResp } from '../../schemas/user.js'

/** AI 与 REST 共用的身份输入。actorId 必须来自服务端认证结果，不可由模型指定。 */
export interface DataScopeIdentity {
  readonly userId: number
  readonly roleIds: readonly number[]
  readonly deptIds: readonly number[]
  /** PAT 授权的权限码；JWT/cookie 路径为 undefined。 */
  readonly tokenScope?: readonly string[]
  /**
   * 已算好的「本次操作下是否超管」。
   *
   * 调用方若已经算过一次有效权限（AI 执行链就是），传进来可省掉一次重复查询，
   * 也避免同一判定出现第二个实现来源。缺省时才在这里查询。
   */
  readonly superAdmin?: boolean
}

/**
 * 构造行级数据权限的主体，并计算「在 `permissionCode` 这项操作下」的超管判定。
 *
 * 超管哨兵与 PAT scope 求交后才算数：PAT 未显式授予哨兵就拿不到全量范围。
 */
export async function buildDataScopeSubject(
  identity: DataScopeIdentity,
  permissionCode: string | undefined,
): Promise<DataScopeSubject> {
  const roleIds = [...new Set((identity.roleIds ?? []).map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0))]

  let superAdmin = identity.superAdmin === true
  if (identity.superAdmin === undefined && roleIds.length > 0) {
    const { perms: rolePerms } = await PermissionService.loadForRoleIds(roleIds)
    const effective = computeEffectivePerms(rolePerms, identity.tokenScope, PERMISSION_CODES)
    superAdmin = effective.has(SUPER_ADMIN_BYPASS)
  }

  return {
    userId: identity.userId,
    roleIds,
    deptIds: [...new Set((identity.deptIds ?? []).map((id) => Number(id)).filter((id) => !isNaN(id)))],
    superAdmin,
    tokenScope: identity.tokenScope ? [...identity.tokenScope] : undefined,
    permissionCode,
  }
}

/** REST 路径：从已鉴权的 request 构造身份。 */
function identityOf(request: FastifyRequest): DataScopeIdentity | null {
  const currentUser = request.currentUser as SysUserResp | undefined
  if (!currentUser?.id) return null
  return {
    userId: currentUser.id,
    roleIds: currentUser.roleIds ?? [],
    deptIds: currentUser.deptIds ?? [],
    tokenScope: request.tokenScope,
  }
}

/**
 * 在给定身份与操作权限码下执行一段逻辑（AI 能力调用走这里）。
 *
 * 上下文只在这段逻辑的执行期间存在，因此并发请求、异步工具调用、流式响应都各自
 * 持有自己的 subject，不会在请求之间串用身份。
 */
export async function establishDataScopeFor<T>(
  identity: DataScopeIdentity,
  permissionCode: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const subject = await buildDataScopeSubject(identity, permissionCode)
  return runWithDataScope(subject, fn)
}

export default fp(
  async (fastify: FastifyInstance) => {
    const establishDataScope: preHandlerHookHandler = (request, _reply, done) => {
      const identity = identityOf(request)
      if (!identity) return done()
      const permissionCode = request.routeOptions?.schema?.['x-permission-code']
      buildDataScopeSubject(identity, permissionCode)
        .then((subject) => {
          // 在 ALS 内调用 done，后续 preHandler 与 handler 都在同一上下文。
          runWithDataScope(subject, () => done())
        })
        .catch(done)
    }
    fastify.decorate('establishDataScope', establishDataScope)
  },
  { name: 'data-scope', dependencies: ['jwt-auth'] },
)
