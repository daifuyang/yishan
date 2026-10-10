/**
 * effective-permissions.ts — 有效权限计算（kernel，纯函数，不访问存储）。
 *
 * 输入是 AuthProvider.loadPermissions 返回的“用户权限集合”、PAT scope 与活动权限目录；
 * 输出是本次请求真正可用的权限集合。system 的 permission.service 重导出这些符号以保持兼容。
 */

/** 超管哨兵：持有即视为拥有全部权限。与活动目录无关，但可以作为 PAT scope 显式授予。 */
export const SUPER_ADMIN_BYPASS = '__super_admin__'

/** PAT scope 通配符：完全继承用户权限（含超管哨兵）。 */
export const PAT_WILDCARD = '*'

/**
 * activeCodes 不包含 SUPER_ADMIN_BYPASS / PAT_WILDCARD（内部流转），
 * 这两个值总是视为活动。
 */
function isActiveForPat(code: string, activeCodes: ReadonlySet<string>): boolean {
  if (code === SUPER_ADMIN_BYPASS || code === PAT_WILDCARD) return true
  return activeCodes.has(code)
}

/**
 * 计算最终有效权限：
 *   - tokenScope undefined           → JWT/cookie 路径：effective = rolePerms
 *   - tokenScope contains '*'         → 通配：effective = rolePerms ∩ activeCodes（含 super_admin 旁路）
 *   - tokenScope length 0             → 显式空：拒绝一切
 *   - tokenScope non-empty list       → 交集 rolePerms ∩ tokenScope ∩ activeCodes
 *                                       super_admin 旁路被剥离（除非在 * 或显式哨兵）
 */
export function computeEffectivePerms(
  rolePerms: ReadonlySet<string>,
  tokenScope: readonly string[] | undefined,
  activeCodes: ReadonlySet<string>,
): Set<string> {
  // JWT/cookie 路径：直接以 rolePerms 为准，不做 active 过滤
  if (tokenScope === undefined) {
    return new Set(rolePerms)
  }
  // PAT 显式空 scope：拒绝一切
  if (tokenScope.length === 0) {
    return new Set()
  }
  // PAT 通配 '*'：完整 rolePerms ∩ activeCodes
  if (tokenScope.includes(PAT_WILDCARD)) {
    return new Set([...rolePerms].filter((code) => isActiveForPat(code, activeCodes)))
  }
  // PAT 显式 scopes：rolePerms ∩ scopes ∩ activeCodes
  const out = new Set<string>()
  for (const code of tokenScope) {
    if (!rolePerms.has(code)) continue
    if (!isActiveForPat(code, activeCodes)) continue
    out.add(code)
  }
  return out
}

/** 有效权限集合是否授予 code（超管哨兵短路）。 */
export function hasPermission(perms: ReadonlySet<string>, code: string): boolean {
  return perms.has(SUPER_ADMIN_BYPASS) || perms.has(code)
}
