import { aliasedTable, and, asc, desc, eq, getTableColumns, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { drizzleDb, type AppQueryDb, type AppTx } from "@/db";
import { sysUser, sysUserDept, sysUserRole } from "@/db/schema";
import { currentDataScope, resolveDataScope, scopedQueryCondition } from "@/core/auth/data-scope";
import { dateUtils } from "../../utils/date.js";
import { UserTokenRepository } from "./user-token.repository.js";
import { clampOffset } from "./_pagination.js";

type UserRow = typeof sysUser.$inferSelect;
type PublicUserRow = Omit<UserRow, "passwordHash" | "deletedAt" | "version">;

interface UserDetailBaseRow extends PublicUserRow {
  creatorName: string | null;
  updaterName: string | null;
}

export interface UserDetailRow extends UserDetailBaseRow {
  deptIds: number[];
  roleIds: number[];
}

type UserPersistedFields = Pick<
  typeof sysUser.$inferInsert,
  "username" | "email" | "phone" | "realName" | "nickname" | "avatar" | "gender" | "birthDate" | "status"
>;

export interface CreateUserInput extends UserPersistedFields {
  passwordHash: string;
  creatorId: number;
  updaterId: number;
  deptIds?: number[];
  roleIds?: number[];
}

export interface UpdateUserInput extends Partial<UserPersistedFields> {
  passwordHash?: string;
  updaterId: number;
  deptIds?: number[];
  roleIds?: number[];
}

export interface LoginAuthInfo {
  id: number;
  username: string | null;
  email: string | null;
  realName: string | null;
  passwordHash: string;
  status: number;
  deletedAt: Date | null;
  loginCount: number;
}

const { passwordHash: _passwordHash, deletedAt: _deletedAt, version: _version, ...userPublicColumns } = getTableColumns(sysUser);

const USER_ORDER_COLUMNS = {
  createdAt: sysUser.createdAt,
  updatedAt: sysUser.updatedAt,
  lastLoginTime: sysUser.lastLoginTime,
  loginCount: sysUser.loginCount,
} as const;
type UserOrderBy = keyof typeof USER_ORDER_COLUMNS;
const DEFAULT_USER_ORDER_BY: UserOrderBy = "createdAt";

function resolveUserOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in USER_ORDER_COLUMNS) {
    return USER_ORDER_COLUMNS[sortBy as UserOrderBy];
  }
  return USER_ORDER_COLUMNS[DEFAULT_USER_ORDER_BY];
}

function buildUserWhere(opts: { keyword?: string; status?: string | number; startTime?: Date; endTime?: Date; dataScope?: SQL }): SQL | undefined {
  const conds: SQL[] = [isNull(sysUser.deletedAt)];
  // 行级数据权限（sys_role.data_scope）。list 与 count 共用本函数，
  // 因此「列表」与「统计」天然同范围——这是验收项，不是巧合。
  if (opts.dataScope) {
    conds.push(opts.dataScope);
  }
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(
      or(
        like(sysUser.username, like_),
        like(sysUser.email, like_),
        like(sysUser.realName, like_),
        like(sysUser.nickname, like_),
      )!
    );
  }
  if (opts.status !== undefined) {
    const statusNum = typeof opts.status === "string" ? parseInt(opts.status, 10) : opts.status;
    conds.push(eq(sysUser.status, statusNum));
  }
  if (opts.startTime) {
    conds.push(sql`${sysUser.createdAt} >= ${opts.startTime}`);
  }
  if (opts.endTime) {
    conds.push(sql`${sysUser.createdAt} <= ${opts.endTime}`);
  }
  return and(...conds);
}

/**
 * 读一个用户的完整详情。
 *
 * `forUpdate` 把三次读全部变成**当前读**（`FOR UPDATE`），而不只是给主表加锁。
 * 这不是可选优化：草稿重放路径在 REPEATABLE READ 下必须读到**并发提交之后**的
 * 那个用户 —— 事务开始时的快照里根本没有它，于是「重复提交」会被误判成
 * 「对应用户已被删除」。部门/角色关联行同样是刚由另一个事务写入的，
 * 只锁主表的话回执里的 roleIds / deptIds 会是空的。
 */
/**
 * 执行查询，可选地加上行锁。
 *
 * drizzle 0.44 的 MySQL `select` 没有公开 `for()` 的类型（`select.types.d.ts` 里没有这个成员），
 * 但运行时确实会把它渲染成 SQL 末尾的 `FOR UPDATE`，因此这里收窄一次类型。
 */
function execute<T>(query: Promise<T> | { for: (strength: string) => Promise<T> }, forUpdate: boolean): Promise<T> {
  return forUpdate ? (query as { for: (strength: string) => Promise<T> }).for('update') : (query as Promise<T>);
}

async function fetchUserDetail(id: number, db: AppQueryDb = drizzleDb, dataScope?: SQL, forUpdate = false): Promise<UserDetailRow | null> {
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");

  // dataScope 与主键条件并列 AND：越权读取返回 null（表现为「不存在」），
  // 而不是泄露「存在但无权限」——后者本身就是信息泄露。
  const base = db
    .select({
      ...userPublicColumns,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysUser)
    .leftJoin(creatorUser, eq(creatorUser.id, sysUser.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysUser.updaterId))
    .where(and(eq(sysUser.id, id), isNull(sysUser.deletedAt), dataScope))
    .limit(1);
  const [row]: UserDetailBaseRow[] = await execute(base, forUpdate);

  if (!row) return null;

  const deptLinks = await execute(
    db
      .select({ deptId: sysUserDept.deptId })
      .from(sysUserDept)
      .where(and(eq(sysUserDept.userId, id), isNull(sysUserDept.deletedAt))),
    forUpdate,
  );

  const roleLinks = await execute(
    db
      .select({ roleId: sysUserRole.roleId })
      .from(sysUserRole)
      .where(and(eq(sysUserRole.userId, id), isNull(sysUserRole.deletedAt))),
    forUpdate,
  );

  return {
    ...row,
    deptIds: deptLinks.map(link => link.deptId),
    roleIds: roleLinks.map(link => link.roleId),
  };
}

function sqlCount() {
  return sql<number>`count(*)`;
}

export type UserListRowWithRelations = PublicUserRow & {
  creator?: { username: string | null } | null;
  updater?: { username: string | null } | null;
};

export class UserRepository {
  /**
   * 当前请求的行级数据范围条件。
   *
   * `enforceScope=false` 是**显式**的免过滤开关：`jwt-auth` 用 findById 解析当前
   * 登录用户自己、刷新令牌校验等路径必须不过滤，否则登录会被自己的范围卡住。
   *
   * 除此之外缺上下文（未认证、非请求任务、上下文建立失败）一律返回恒假条件，
   * 而不是返回 undefined 静默放开。
   */
  static async dataScopeCondition(enforceScope: boolean): Promise<SQL | undefined> {
    const subject = currentDataScope()
    if (!enforceScope) return undefined
    return scopedQueryCondition(subject, subject ? await resolveDataScope(subject) : null, enforceScope)
  }

  // 新的标准方法
  static async list(query: { page?: number; pageSize?: number; keyword?: string; status?: string | number; sortBy?: string; sortOrder?: string; startTime?: Date; endTime?: Date } = {}, enforceScope = true): Promise<UserListRowWithRelations[]> {
    const { page = 1, pageSize = 10, sortBy, sortOrder = "desc" } = query;
    const where = buildUserWhere({ ...query, dataScope: await UserRepository.dataScopeCondition(enforceScope) });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveUserOrderColumn(sortBy);

    const baseQuery = {
      where,
      orderBy: dir(orderCol),
      with: {
        creator: { columns: { username: true } },
        updater: { columns: { username: true } },
      },
    } as const;

    const items = await drizzleDb.query.sysUser.findMany({
      ...baseQuery,
      limit: pageSize,
      offset: clampOffset(page, pageSize),
    });

    return items;
  }

  static async count(query: { keyword?: string; status?: string | number; startTime?: Date; endTime?: Date } = {}, enforceScope = true): Promise<number> {
    const where = buildUserWhere({ ...query, dataScope: await UserRepository.dataScopeCondition(enforceScope) });
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysUser).where(where);
    return Number(row?.c ?? 0);
  }

  /**
   * 按 id 读详情。默认**施加**行级范围（`enforceScope=true`）：
   * 按 id 直读是最容易绕过滤的入口，缺省必须关上门。
   * 只有登录解析自己、刷新令牌这类内部路径才显式传 false。
   */
  /** `forUpdate` 见 {@link fetchUserDetail}：草稿重放路径必须读到并发提交之后的行。 */
  static async findById(id: number, db: AppQueryDb = drizzleDb, enforceScope = true, forUpdate = false): Promise<UserDetailRow | null> {
    return fetchUserDetail(id, db, await UserRepository.dataScopeCondition(enforceScope), forUpdate);
  }

  /** 用调用方已解析好的 dataScope 条件读取，避免同一个请求里重复解析档位。 */
  static async findByIdWithScope(id: number, dataScope?: SQL, db: AppQueryDb = drizzleDb, forUpdate = false): Promise<UserDetailRow | null> {
    return fetchUserDetail(id, db, dataScope, forUpdate);
  }

  /**
   * 当前用户的启用部门 ID（sys_user_dept 上的有效关联）。
   *
   * 行级范围解析需要「操作者自己的部门」，而这份数据必须来自服务端重载：
   * 客户端或模型传入的 deptIds 一律不可信。免行级过滤（授权判定本来就要看到
   * 操作者的全部部门），因此不走 dataScopeCondition。
   */
  static async loadActiveDeptIdsByUserId(userId: number, db: AppQueryDb = drizzleDb): Promise<number[]> {
    const rows = await db
      .select({ deptId: sysUserDept.deptId })
      .from(sysUserDept)
      .where(and(eq(sysUserDept.userId, userId), isNull(sysUserDept.deletedAt)));
    return [...new Set(rows.map((row) => row.deptId))];
  }

  static async findIdByUsername(username: string, db: AppQueryDb = drizzleDb): Promise<number | null> {
    const [row] = await db
      .select({ id: sysUser.id })
      .from(sysUser)
      .where(and(eq(sysUser.username, username), isNull(sysUser.deletedAt)))
      .limit(1);
    return row?.id ?? null;
  }

  static async findIdByEmail(email: string, db: AppQueryDb = drizzleDb): Promise<number | null> {
    const [row] = await db
      .select({ id: sysUser.id })
      .from(sysUser)
      .where(and(eq(sysUser.email, email), isNull(sysUser.deletedAt)))
      .limit(1);
    return row?.id ?? null;
  }

  static async findIdByPhone(phone: string, db: AppQueryDb = drizzleDb): Promise<number | null> {
    const [row] = await db
      .select({ id: sysUser.id })
      .from(sysUser)
      .where(and(eq(sysUser.phone, phone), isNull(sysUser.deletedAt)))
      .limit(1);
    return row?.id ?? null;
  }

  static async findAuthIdentityByLogin(usernameOrEmail: string): Promise<LoginAuthInfo | null> {
    const [row] = await drizzleDb
      .select({
        id: sysUser.id,
        username: sysUser.username,
        email: sysUser.email,
        realName: sysUser.realName,
        passwordHash: sysUser.passwordHash,
        status: sysUser.status,
        deletedAt: sysUser.deletedAt,
        loginCount: sysUser.loginCount,
      })
      .from(sysUser)
      .where(
        and(
          or(eq(sysUser.username, usernameOrEmail), eq(sysUser.email, usernameOrEmail))!
        )
      )
      .limit(1);
    return row ?? null;
  }

  static async incrementLoginCount(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(sysUser)
      .set({
        loginCount: sql`${sysUser.loginCount} + 1`,
        updatedAt: dateUtils.now(),
      })
      .where(eq(sysUser.id, id));
  }

  /**
   * Record a successful login: stamp `lastLoginTime` / `lastLoginIp` /
   * `updatedAt` and bump `loginCount` atomically within a single DB call.
   * Replaces the previous two-step pattern in AuthService.
   */
  static async recordSuccessfulLogin(userId: number, ip: string, db: AppQueryDb = drizzleDb): Promise<void> {
    const now = dateUtils.now();
    await db
      .update(sysUser)
      .set({
        lastLoginTime: now,
        lastLoginIp: ip,
        updatedAt: now,
        loginCount: sql`${sysUser.loginCount} + 1`,
      })
      .where(eq(sysUser.id, userId));
  }

  /**
   * List enabled (status = 1) users that have an active (not soft-deleted)
   * link in `sys_user_dept` to the given department. Replaces the EXISTS
   * subquery previously inlined in the contacts route.
   */
  static async findActiveUsersByDeptId(deptId: number, db: AppQueryDb = drizzleDb): Promise<PublicUserRow[]> {
    const rows = await db
      .select(userPublicColumns)
      .from(sysUser)
      .where(
        and(
          isNull(sysUser.deletedAt),
          eq(sysUser.status, 1),
          await UserRepository.dataScopeCondition(true),
          sql`EXISTS (
            SELECT 1 FROM ${sysUserDept}
            WHERE ${sysUserDept.userId} = ${sysUser.id}
              AND ${sysUserDept.deptId} = ${deptId}
              AND ${sysUserDept.deletedAt} IS NULL
          )`,
        ),
      )
      .orderBy(asc(sysUser.id));
    return rows as PublicUserRow[];
  }



  static async create(input: CreateUserInput, db: AppQueryDb = drizzleDb): Promise<UserDetailRow> {
    const { deptIds, roleIds, ...user } = input;
    const uniqueDeptIds = deptIds ? [...new Set(deptIds)] : [];
    const uniqueRoleIds = roleIds ? [...new Set(roleIds)] : [];
    const now = dateUtils.now();

    const insertData: typeof sysUser.$inferInsert = {
      ...user,
      loginCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const [inserted] = await db.insert(sysUser).values(insertData).$returningId();

    if (uniqueDeptIds.length > 0) {
      await db.insert(sysUserDept).values(
        uniqueDeptIds.map(deptId => ({ userId: inserted.id, deptId }))
      );
    }

    if (uniqueRoleIds.length > 0) {
      await db.insert(sysUserRole).values(
        uniqueRoleIds.map(roleId => ({ userId: inserted.id, roleId }))
      );
    }

    const finalUser = await fetchUserDetail(inserted.id, db);
    if (!finalUser) throw new Error("Failed to read back created user");
    return finalUser;
  }

  static async update(id: number, input: UpdateUserInput, db: AppQueryDb = drizzleDb): Promise<UserDetailRow> {
    const { deptIds, roleIds, ...user } = input;
    const updateData: Partial<typeof sysUser.$inferInsert> = {
      ...user,
      updatedAt: dateUtils.now(),
    };

    await db
      .update(sysUser)
      .set(updateData)
      .where(and(eq(sysUser.id, id), isNull(sysUser.deletedAt)));

    if (deptIds !== undefined) {
      const uniqueDeptIds = [...new Set(deptIds)];
      const existingLinks = await db
        .select({ deptId: sysUserDept.deptId })
        .from(sysUserDept)
        .where(and(eq(sysUserDept.userId, id), isNull(sysUserDept.deletedAt)));
      const existingIds = existingLinks.map(link => link.deptId);
      const toCreate = uniqueDeptIds.filter(d => !existingIds.includes(d));
      const toDelete = existingIds.filter(d => !uniqueDeptIds.includes(d));

      if (toCreate.length) {
        await db.insert(sysUserDept).values(toCreate.map(deptId => ({ userId: id, deptId })));
      }

      if (toDelete.length) {
        await db.delete(sysUserDept).where(and(eq(sysUserDept.userId, id), inArray(sysUserDept.deptId, toDelete)));
      }
    }

    if (roleIds !== undefined) {
      const uniqueRoleIds = [...new Set(roleIds)];
      const existingLinks = await db
        .select({ roleId: sysUserRole.roleId })
        .from(sysUserRole)
        .where(and(eq(sysUserRole.userId, id), isNull(sysUserRole.deletedAt)));
      const existingIds = existingLinks.map(link => link.roleId);
      const toCreate = uniqueRoleIds.filter(r => !existingIds.includes(r));
      const toDelete = existingIds.filter(r => !uniqueRoleIds.includes(r));

      if (toCreate.length) {
        await db.insert(sysUserRole).values(toCreate.map(roleId => ({ userId: id, roleId })));
      }

      if (toDelete.length) {
        await db.delete(sysUserRole).where(and(eq(sysUserRole.userId, id), inArray(sysUserRole.roleId, toDelete)));
      }
    }

    const finalUser = await fetchUserDetail(id, db);
    if (!finalUser) throw new Error("Failed to read back updated user");
    return finalUser;
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<UserRow | null> {
    const [existing] = await db
      .select({ id: sysUser.id })
      .from(sysUser)
      .where(and(eq(sysUser.id, id), isNull(sysUser.deletedAt)))
      .limit(1);
    if (!existing) return null;

    const now = dateUtils.now();

    await db
      .update(sysUser)
      .set({
        deletedAt: now,
        status: 0,
        updatedAt: now,
      })
      .where(eq(sysUser.id, id));

    await db
      .update(sysUserDept)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(sysUserDept.userId, id));

    await db
      .update(sysUserRole)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(sysUserRole.userId, id));

    const [deleted] = await db
      .select()
      .from(sysUser)
      .where(eq(sysUser.id, id))
      .limit(1);
    return deleted ?? null;
  }

  static async syncDepartments(userId: number, deptIds: number[], db: AppQueryDb = drizzleDb): Promise<void> {
    const uniqueDeptIds = [...new Set(deptIds)];
    const existingLinks = await db
      .select({ deptId: sysUserDept.deptId })
      .from(sysUserDept)
      .where(and(eq(sysUserDept.userId, userId), isNull(sysUserDept.deletedAt)));
    const existingIds = existingLinks.map(link => link.deptId);
    const toCreate = uniqueDeptIds.filter(d => !existingIds.includes(d));
    const toDelete = existingIds.filter(d => !uniqueDeptIds.includes(d));

    if (toCreate.length) {
      await db.insert(sysUserDept).values(toCreate.map(deptId => ({ userId, deptId })));
    }

    if (toDelete.length) {
      await db.delete(sysUserDept).where(and(eq(sysUserDept.userId, userId), inArray(sysUserDept.deptId, toDelete)));
    }
  }

  static async syncRoles(userId: number, roleIds: number[], db: AppQueryDb = drizzleDb): Promise<void> {
    const uniqueRoleIds = [...new Set(roleIds)];
    const existingLinks = await db
      .select({ roleId: sysUserRole.roleId })
      .from(sysUserRole)
      .where(and(eq(sysUserRole.userId, userId), isNull(sysUserRole.deletedAt)));
    const existingIds = existingLinks.map(link => link.roleId);
    const toCreate = uniqueRoleIds.filter(r => !existingIds.includes(r));
    const toDelete = existingIds.filter(r => !uniqueRoleIds.includes(r));

    if (toCreate.length) {
      await db.insert(sysUserRole).values(toCreate.map(roleId => ({ userId, roleId })));
    }

    if (toDelete.length) {
      await db.delete(sysUserRole).where(and(eq(sysUserRole.userId, userId), inArray(sysUserRole.roleId, toDelete)));
    }
  }

  // --------------------------------------------------------------------------
  // Password / Sensitive data
  // --------------------------------------------------------------------------

  /**
   * 读取用户的 passwordHash（仅供 Service 层做旧密码校验使用）。
   * 未命中或用户已软删返回 `null`；Service 拿到 null 后应抛 "用户不存在"。
   */
  static async findPasswordHashById(userId: number, db: AppQueryDb = drizzleDb): Promise<string | null> {
    const [row] = await db
      .select({ passwordHash: sysUser.passwordHash })
      .from(sysUser)
      .where(and(eq(sysUser.id, userId), isNull(sysUser.deletedAt)))
      .limit(1);
    return row?.passwordHash ?? null;
  }

  /**
   * Replace a legacy password hash after a successful login. The previous hash
   * remains part of the predicate so a concurrent password reset cannot be
   * overwritten by a delayed login upgrade.
   */
  static async upgradePasswordHash(userId: number, previousHash: string, passwordHash: string): Promise<boolean> {
    const [result] = await drizzleDb
      .update(sysUser)
      .set({ passwordHash, updaterId: userId, updatedAt: dateUtils.now() })
      .where(and(eq(sysUser.id, userId), eq(sysUser.passwordHash, previousHash), isNull(sysUser.deletedAt)));
    return result.affectedRows === 1;
  }

  // --------------------------------------------------------------------------
  // Transactional wrappers
  //
  // 高层事务方法，把"开事务 + 跨 repository 调用"收敛在 Repository 层，
  // 这样 Service 层不需要直接持有 `drizzleDb`，避免破坏 R1 边界。
  // --------------------------------------------------------------------------

  /**
   * **唯一**的事务开启点。
   *
   * Service 层拿不到 `drizzleDb`，但一次原子创建需要在同一个事务里跨越多个
   * repository（用户 + 唯一性查询 + 草稿回执）。这里把「开事务」收敛在
   * Repository 层并把 `tx` 交给回调，Service 与参与者都只见到事务句柄，
   * 不接触连接对象。
   */
  static async transaction<T>(fn: (tx: AppTx) => Promise<T>): Promise<T> {
    return drizzleDb.transaction(async (tx) => fn(tx as AppTx));
  }

  /**
   * 在事务内创建用户，等价于 `drizzleDb.transaction(tx => UserRepository.create(input, tx))`。
   *
   * 保留给不需要与其他步骤共享事务的普通调用方；需要跨步骤原子性的创建路径
   * 走 `transaction()` 并在回调里自己调 `create(input, tx)`。
   */
  static async createInTransaction(input: CreateUserInput): Promise<UserDetailRow> {
    return UserRepository.transaction((tx) => UserRepository.create(input, tx));
  }

  /**
   * 在事务内更新用户，等价于 `drizzleDb.transaction(tx => UserRepository.update(id, input, tx))`。
   */
  static async updateInTransaction(id: number, input: UpdateUserInput): Promise<UserDetailRow> {
    return drizzleDb.transaction(async (tx) => {
      return UserRepository.update(id, input, tx);
    });
  }

  /**
   * 修改密码：在事务里更新 `passwordHash`，同时撤销该用户所有未撤销的 token
   * （强制重新登录）。两个步骤必须在同一事务内，否则可能出现 "密码已更新
   * 但旧 token 仍有效" 的窗口期。
   */
  static async changePasswordInTransaction(userId: number, passwordHash: string): Promise<void> {
    await drizzleDb.transaction(async (tx) => {
      await UserRepository.update(
        userId,
        { passwordHash, updaterId: userId } as UpdateUserInput,
        tx,
      );
      await UserTokenRepository.revokeAllByUserId(userId, tx);
    });
  }

  /**
   * 删除用户：在事务里软删用户，同时撤销其所有 token，避免已删除用户的
   * 旧 token 在删除与撤销之间继续生效。
   */
  static async deleteUserInTransaction(id: number): Promise<void> {
    await drizzleDb.transaction(async (tx) => {
      await UserRepository.softDelete(id, tx);
      await UserTokenRepository.revokeAllByUserId(id, tx);
    });
  }
}
