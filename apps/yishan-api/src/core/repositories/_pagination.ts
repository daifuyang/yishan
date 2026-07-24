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