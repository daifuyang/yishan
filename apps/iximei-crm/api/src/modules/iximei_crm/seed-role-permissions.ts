/**
 * 默认角色的后端功能/API 权限。
 *
 * 角色菜单与角色权限是两套独立关联：前者只控制导航可见性，后者才决定
 * requirePermission() 是否放行。权限码始终来自 Core 目录或插件 manifest，
 * 种子不创建自由配置的权限定义。
 *
 * 按钮权限矩阵（fork 业务定版）:
 * | 角色 | 医院 | 客户 | 派单 | 会员 | system 下拉 |
 * | --- | --- | --- | --- | --- | --- |
 * | super_admin | ✅ CRUD | ✅ CRUD+dispatch | ✅ 全 | ✅ CRUD+remark | ✅ |
 * | admin       | ❌ | ❌ | ❌ | ❌ | ❌ |
 * | hospital_account | ❌ | ❌ | ✅ 看+回 | ❌ | region |
 * | customer_service | ❌ | ✅ CRUD+dispatch | ✅ 全 | ✅ CRUD+remark | user+region |
 *
 * 数据范围由 `sys_role.data_scope` 字段决定（本文件不再硬编码）。
 * 档位编号以 `access-scope.ts` 的 `DATA_SCOPE` 为准：
 * - 1 ALL：看全部（super_admin bypass 实际不读此字段）
 * - 2 CUSTOM / 3 DEPT / 4 DEPT_AND_CHILDREN：crm 尚未实现部门集合过滤
 * - 5 SELF：仅 owner = 自己
 *
 * 运行时过滤在 service 层 inline 判断 `currentDataScope()` 与
 * `dataScope`，不属于本 seed 文件的关注范围。
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@yishan/core-system-api/database';
import { sysRole, sysRolePermission } from '@yishan/core-system-api/schema';
import { listPermissions } from '@yishan/core-api/permissions/catalog';
import { CRM_ROLES, ROLE_IDS } from './role-codes';

type SeedDb = AppDb;

/**
 * 两个行业角色由业务模块自己创建。
 *
 * 上游 `seedSystem` 只建 super_admin / admin（按 code 幂等，不固定 ID），
 * 医院账号与客服是 crm 的业务角色，Core 不该知道它们的存在。
 *
 * 这里**按 code 查找优先**：线上库已有这两个角色（id 3 / 4），直接复用，
 * 不会因为 ID 被占而失败；新库则显式写入固定 ID，让 `ROLE_IDS` 的数字判断
 * 在两个环境里都成立。
 */
async function ensureCrmRoles(db: SeedDb, creatorId: number) {
  const roles: number[] = [];
  for (const seed of CRM_ROLES) {
    // 1. 先按 ID 找：线上库就是这条路径，不能因为 code 名称不同就重建角色。
    const byId = await db.query.sysRole.findFirst({ where: eq(sysRole.id, seed.id) });
    if (byId) {
      roles.push(byId.id);
      continue;
    }
    // 2. 再按 code 找：ID 被别的角色占了但 code 命中，说明库被重排过。
    const byCode = await db.query.sysRole.findFirst({ where: eq(sysRole.code, seed.code) });
    if (byCode) {
      console.warn(`[iximei-crm seed] 角色 ${seed.code} 的 id 是 ${byCode.id}，与约定的 ${seed.id} 不一致；业务代码里的 ROLE_IDS 判断需要同步调整。`);
      roles.push(byCode.id);
      continue;
    }
    // 3. 都没有：新库首次写入，用固定槽位建。
    await db.insert(sysRole).values({
      id: seed.id,
      name: seed.name,
      code: seed.code,
      description: seed.description,
      status: 1,
      isSystemDefault: true,
      creatorId,
      updaterId: creatorId,
    });
    roles.push(seed.id);
  }
  return roles;
}

async function findRoleById(db: SeedDb, id: number) {
  const role = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.id, id), isNull(sysRole.deletedAt)),
  });
  if (!role) throw new Error(`系统角色缺失 id=${id}`);
  return role;
}

async function replaceRolePermissions(
  db: SeedDb,
  roleId: number,
  permissionCodes: readonly string[],
  creatorId: number,
) {
  await db
    .update(sysRolePermission)
    .set({ deletedAt: new Date() })
    .where(and(eq(sysRolePermission.roleId, roleId), isNull(sysRolePermission.deletedAt)));

  const uniqueCodes = [...new Set(permissionCodes)];
  if (uniqueCodes.length === 0) return;
  await db
    .insert(sysRolePermission)
    .values(uniqueCodes.map((permissionCode) => ({ roleId, permissionCode, creatorId })))
    .onDuplicateKeyUpdate({ set: { deletedAt: null, creatorId } });
}

/**
 * 医院账号(hospital_account)不能持有的派单派生 perm 黑名单。
 *
 * 设计要点：
 * - `crm:dispatches:` 前缀匹配 + 黑名单：未来新增派生 perm 会自动跟随,
 *   但 :update / :delete / :view-mobile-logs / :view-hospital-log 显式拒绝。
 *   这些是 admin / super_admin 专用 —— 编辑 / 删除派单 / 查看审计日志。
 */
export const HOSPITAL_ACCOUNT_DISPATCH_DENY: ReadonlySet<string> = new Set([
  'crm:dispatches:update',           // 不能编辑派单内容
  'crm:dispatches:delete',           // 不能删派单
  'crm:dispatches:view-mobile-logs', // 审计日志只给 super_admin
  'crm:dispatches:view-hospital-log', // 医院查看日志只给 super_admin / admin
])

/**
 * 计算医院账号(hospital_account)应该持有的权限码集合（纯函数，可直接单元测试）。
 *
 * - `crm:dispatches:` 前缀匹配 + 黑名单：未来新增派生 perm 会自动跟随,
 *   但 :update / :delete / :view-mobile-logs / :view-hospital-log 显式拒绝。
 * - `crm:hospital-dashboard:` 前缀全授予：当前仅 :view,语义上就是给医院账号看本院看板。
 * - `crm:hospitals:` **显式白名单**（plan §5.3.3）:不自动跟随新增的 :rename / :create / :delete。
 *   持有 :update 是为了让医院账号能改自己医院资料(地址/经营性质等)，
 *   但**不持有** crm:hospitals:manage-account —— 账号管理(启停/重置密码/改账号邮箱手机号)
 *   是 admin 级操作,医院账号不应拥有。
 * - region 一族 4 个 perm code 中,医院账号业务只需 tree(级联树)+ path(回填路径);
 *   list/read 是 admin 端只读管理页用的,不给医院账号。
 *
 * 历史漏配：2026-09 用户反馈 hospital_account 登录后进 /crm/dispatches 报"权限不足"。
 * 根因是 seed 里 hospitalAccountCodes 用**显式白名单**列了 5 条 crm:dispatches 派生 perm,
 * 漏配了 crm:dispatches:log —— 前端"派单跟进"按钮触发该 perm 的接口 → 403。
 * 修复方案：seed 改为 `crm:dispatches:` 前缀匹配 + 黑名单,未来新增派生 perm 会自动跟随,
 * 但 :update / :delete / :view-mobile-logs / :view-hospital-log 这些 admin/super 专用权限
 * 由黑名单显式拒绝。
 */
export function computeHospitalAccountCodes(allCodes: readonly string[]): string[] {
  return allCodes.filter((code) =>
    (code.startsWith('crm:dispatches:') && !HOSPITAL_ACCOUNT_DISPATCH_DENY.has(code)) ||
    code.startsWith('crm:hospital-dashboard:') ||
    code === 'crm:hospitals:list' ||
    code === 'crm:hospitals:update' ||
    code === 'region:tree' ||
    code === 'region:path',
  )
}

/**
 * 基线权限：任何能登录的账号都必须持有，与业务角色无关。
 *
 * 两类东西，缺了都会让「登录成功」变成「进去一片空白」：
 *
 *   1. 会话本身 —— 拿当前用户（`auth:profile`）、登出、刷新令牌。
 *      缺 `auth:profile` 的表现最隐蔽：登录 200 拿到 token，但前端一刷新
 *      调 `/api/v1/auth/me` 就 403，页面直接空掉。
 *   2. 自助操作 —— 改自己的密码、改自己的资料、看自己的登录日志。
 *      老系统迁移后「登录 → 提示改密 → 去改密」这条路依赖它。
 *
 * 上游把这些码定义在 `auth/*` 与 `app/*` 路由里，却没有任何角色的 seed
 * 绑定过它们；除 super_admin（靠 bypass 哨兵）之外全员缺。所以在产品侧显式补齐。
 *
 * 只放「只作用于自己 / 只作用于当前会话」的码，不含任何跨用户能力。
 */
const BASELINE_CODES = [
  // 管理端会话（/api/v1/auth/*）
  'auth:login',
  'auth:profile',
  'auth:logout',
  'auth:refresh',
  // 移动端会话（/api/v1/app/auth/*）
  'app:auth:login',
  'app:auth:profile',
  'app:auth:logout',
  'app:auth:refresh',
  // 移动端自助（/api/v1/app/users/me/*）
  'app:user:update-me',
  'app:user:change-pwd',
  'app:user:my-logins',
] as const

/** 把基线权限并入某个角色的码表（去重，且只并入当前目录里真实存在的码）。 */
function withBaseline(codes: readonly string[], allCodes: readonly string[]): string[] {
  const available = new Set(allCodes)
  const merged = new Set(codes)
  for (const code of BASELINE_CODES) {
    if (available.has(code)) merged.add(code)
  }
  return [...merged]
}

export async function bindRolePermissionsByDefault(db: SeedDb, adminUserId: number) {  const [superAdmin, admin, hospitalAccount, customerService] = await Promise.all([
    findRoleById(db, ROLE_IDS.SUPER_ADMIN),
    findRoleById(db, ROLE_IDS.ADMIN),
  ]).then(async ([superAdmin, admin]) => {
    // 业务角色按需创建，再按 ID 取回，保证下面四处绑定用的是库里的真实主键。
    await ensureCrmRoles(db, adminUserId);
    return [
      superAdmin,
      admin,
      await findRoleById(db, ROLE_IDS.HOSPITAL_ACCOUNT),
      await findRoleById(db, ROLE_IDS.CUSTOMER_SERVICE),
    ] as const;
  });
  const allCodes = listPermissions().map((item) => item.code);

  // 超级管理员: 全量 crm + system
  const superAdminCodes = allCodes

  // 普通管理员（fork 业务不配 CRM 权限）: 仅留登录入口，rbac preHandler 拒绝一切 crm 接口。
  // 菜单树和启用字典映射属于“已登录即可读取”的启动基建，已由 route registrar 统一处理，
  // 不应作为每个角色都要配置的业务权限。
  // 自助权限与当前会话权限除外 —— 见 BASELINE_CODES 的说明。
  const adminCodes = allCodes.filter((code) => code === 'auth:login')

  // 医院账号：医院档案查看+编辑 + 派单'看+回+跟' + 医院看板 + 区域下拉。
  // 派生 perm 计算走 computeHospitalAccountCodes（纯函数，单元测试覆盖）。
  const hospitalAccountCodes = computeHospitalAccountCodes(allCodes)

  // 客服（商务）：客户 CRUD+派单 + 派单管理 + 会员 CRUD + 区域/用户下拉 + 自己管 API Token。
  // 注意:不持有 crm:hospitals:* —— 医院档案是商务端的资料.
  // region 一族同上,只授 tree + path;list/read 不给(避免泄露 admin 端管理界面入口)。
  const customerServiceCodes = allCodes.filter((code) =>
    [
      'crm:customers:list', 'crm:customers:create', 'crm:customers:update', 'crm:customers:dispatch',
      'crm:hospitals:options',
      'crm:dispatches:list', 'crm:dispatches:reply',
    ].includes(code) ||
    code === 'system:user:list' ||
    code === 'region:tree' ||
    code === 'region:path',
  )

  // 必须**串行**：`replaceRolePermissions` 是「先软删旧行、再批量插入新行」两步。
  // 四个角色并发跑同样的步骤时，会互相交叉持有 sys_role_permission 的间隙锁，
  // 在 REPEATABLE READ 下直接死锁（实测 ER_LOCK_DEADLOCK 1213）。
  // 串行的代价只是 4 组语句的往返，换确定性。
  const assignments: Array<[number, string[]]> = [
    [superAdmin.id, withBaseline(superAdminCodes, allCodes)],
    [admin.id, withBaseline(adminCodes, allCodes)],
    [hospitalAccount.id, withBaseline(hospitalAccountCodes, allCodes)],
    [customerService.id, withBaseline(customerServiceCodes, allCodes)],
  ];
  for (const [roleId, codes] of assignments) {
    await replaceRolePermissions(db, roleId, codes, adminUserId);
  }
}
