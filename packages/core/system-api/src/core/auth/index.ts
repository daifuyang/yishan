/**
 * 权限计算的公开出口。
 *
 * 消费者（AI 模块等）必须走这里的 `computeEffectivePerms`，**不允许**自己手搓
 * `roleIds` → 权限的判断：那会漏掉 PAT tokenScope 交集与活动目录过滤，
 * 于是「一个只读 PAT」会变成「一把万能钥匙」。
 *
 * 行级数据范围同理：REST 与 AI 都通过 `establishDataScopeFor` 建立上下文，
 * 共用同一份范围解析实现，不维护两套过滤规则。
 */
export { computeEffectivePerms, hasPermission, SUPER_ADMIN_BYPASS, PAT_WILDCARD } from './effective-permissions'
export { PermissionService } from '../services/permission.service'
export {
  establishDataScopeFor,
  buildDataScopeSubject,
  type DataScopeIdentity,
} from '../plugins/external/data-scope'
export {
  DATA_SCOPE_ALL,
  DATA_SCOPE_DEPT,
  DATA_SCOPE_DEPT_AND_CHILD,
  DATA_SCOPE_SELF,
  DATA_SCOPE_CUSTOM,
  currentDataScope,
  isDataScopeBypassed,
  runWithDataScope,
  runWithoutDataScope,
  // 业务模块要按档位翻译自己的查询条件时必须复用这一份解析，而不是自己读 sys_role.data_scope。
  resolveDataScope,
  type DataScopeFilter,
  type DataScopeSubject,
} from './data-scope'
