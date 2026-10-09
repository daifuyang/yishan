/**
 * 分页参数边界与兜底截断工具
 *
 * 背景（FIX-api-validation-2026-07-24 N3）：
 * - Type.Integer() 本身只校验"是整数"，不限数值大小；Fastify query 解析
 *   在 `coerceTypes: 'array'` 下会接受科学计数法（`?page=1e10` → 10000000000）。
 * - 路由 schema 已对 page 加 maximum: 100000（见 core/schemas/common.ts），但
 *   服务层 / 仓库层仍可能因为：
 *     1. 部分接口尚未挂 schema 校验
 *     2. 服务层把 query.page 直接透传给仓库（dict.service / menu.service /
 *        attachment.service / position.service 等）
 *   导致巨大 OFFSET 进入数据库。
 * - 仓库层 `clampOffset` 是兜底：不论上层怎么传，最终 OFFSET 不会超过上限。
 */

export const MAX_PAGE = 100_000;
export const MAX_PAGE_SIZE = 100;
/** 任意 (page, pageSize) 组合下 OFFSET 的硬上限，防止大偏移扫描拖垮 DB */
export const MAX_OFFSET = 1_000_000;

/**
 * 把传入的 page / pageSize 截断到安全区间。
 * - 非法值（NaN / Infinity / 负数 / 0）回退到默认值
 * - 超过上限的整数钳制到上限
 * - 非整数（如浮点）取整
 */
export function clampPage(page: unknown, fallback: number = 1): number {
  const n = typeof page === 'number' ? page : Number(page);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE);
}

export function clampPageSize(pageSize: unknown, fallback: number = 10): number {
  const n = typeof pageSize === 'number' ? pageSize : Number(pageSize);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

/**
 * 计算 OFFSET 并兜底截断到 MAX_OFFSET。
 * 任意 (page, pageSize) 组合下，最坏情况也只是 `MAX_OFFSET` 行的扫描成本。
 */
export function clampOffset(page: number, pageSize: number): number {
  const safePage = clampPage(page);
  const safePageSize = clampPageSize(pageSize);
  return Math.min((safePage - 1) * safePageSize, MAX_OFFSET);
}

/**
 * 任何暴露 `.limit(n)` / `.offset(n)` 链式调用接口的查询构造器
 * （Drizzle 的 SQL builder、`Kysely`、`knex` 等）的最小可用结构。
 *
 * 只声明入参与出参包含数字类型的契约；具体 builder 的丰富类型
 * （列投影、where 子句、select 形态）由调用方在泛型参数 `Q` 上保留。
 */
export interface LimitOffsetCapable {
  limit(n: number): unknown;
  offset(n: number): unknown;
}

/**
 * 把「安全 limit + 安全 offset」一次性应用到链式查询上。
 *
 * 设计要点：
 * - 输入 page / pageSize 都通过 `clampPage` / `clampPageSize` 兜底：
 *   pageSize 永远不会超过 `MAX_PAGE_SIZE`（100），offset 永远不会超过
 *   `MAX_OFFSET`（1_000_000）。上游把 service 的 query 透传进来时不必担心
 *   `?page=1e10` 之类的科学计数法。
 * - 泛型 `Q extends LimitOffsetCapable` 不带具体 builder 的类型推导，
 *   由调用方在调用处显式提供（如 `applyPagination<typeof query>(...)`），
 *   因此仓库层的列类型、select 形态、where 子句类型都不会丢失。
 * - 类型断言 `as Q` 反映的是契约：Drizzle / Kysely / knex 的 `.limit(n)`
 *   总是返回同构的 builder。调用方传非 builder 时 TS 立即拒绝。
 *
 * 显式不包含：软删除 predicate、`deletedAt IS NULL` 注入、owner scope 过滤。
 * 这些都依赖具体表 schema 与权限语义，应在每个 repository 内部按需组合，
 * 不应被一个通用 helper 偷偷带进 core。
 */
export function applyPagination<Q extends LimitOffsetCapable>(
  query: Q,
  pagination: { page: unknown; pageSize: unknown },
): Q {
  const pageSize = clampPageSize(pagination.pageSize);
  const offset = clampOffset(clampPage(pagination.page), pageSize);
  // 分两步应用，避免 `.limit()` 返回值（declared as `unknown`）阻挡
  // `.offset()` 链式调用；Drizzle / Kysely / knex 的 builder 契约保证
  // 两次调用返回同构对象。
  query.limit(pageSize);
  return query.offset(offset) as Q;
}