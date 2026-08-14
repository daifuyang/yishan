/**
 * `_pagination.ts` helper 单元测试。
 *
 * 覆盖 §1.3 准入要求：
 * - 非法值（NaN / Infinity / 负数 / 0）回退到默认值
 * - 超大 page / pageSize 截断到上限
 * - offset 超 MAX_OFFSET 截断
 * - applyPagination 透传 limit/offset 到 builder
 * - 输入字段不接受除 `page` / `pageSize` 之外的字段
 *
 * 不动 service / repository，纯粹工具行为。
 */

import { describe, it, expect, vi } from 'vitest';
import {
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_OFFSET,
  clampPage,
  clampPageSize,
  clampOffset,
  applyPagination,
} from '../src/core/repositories/_pagination.ts';

describe('clampPage —— 单字段边界', () => {
  it('合法正整数原样返回', () => {
    expect(clampPage(1)).toBe(1);
    expect(clampPage(42)).toBe(42);
  });

  it('非法值（NaN / Infinity / 负数 / 0）回退到默认值 1', () => {
    expect(clampPage(NaN)).toBe(1);
    expect(clampPage(Infinity)).toBe(1);
    expect(clampPage(-Infinity)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(null)).toBe(1);
    expect(clampPage('not a number')).toBe(1);
  });

  it('字符串数字会 Number() 转换', () => {
    expect(clampPage('7')).toBe(7);
  });

  it('超过 MAX_PAGE 截断到上限', () => {
    expect(clampPage(MAX_PAGE)).toBe(MAX_PAGE);
    expect(clampPage(MAX_PAGE + 1)).toBe(MAX_PAGE);
    expect(clampPage(1e10)).toBe(MAX_PAGE);
  });

  it('浮点数取整', () => {
    expect(clampPage(3.7)).toBe(3);
    expect(clampPage(3.2)).toBe(3);
  });

  it('fallback 可由调用方覆盖', () => {
    expect(clampPage(0, 5)).toBe(5);
    expect(clampPage(undefined, 7)).toBe(7);
  });
});

describe('clampPageSize —— 单字段边界', () => {
  it('合法正整数原样返回', () => {
    expect(clampPageSize(10)).toBe(10);
    expect(clampPageSize(1)).toBe(1);
  });

  it('非法值回退到默认值 10', () => {
    expect(clampPageSize(NaN)).toBe(10);
    expect(clampPageSize(0)).toBe(10);
    expect(clampPageSize(-1)).toBe(10);
    expect(clampPageSize(undefined)).toBe(10);
    expect(clampPageSize(null)).toBe(10);
  });

  it('超过 MAX_PAGE_SIZE 截断到 100', () => {
    expect(clampPageSize(MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(MAX_PAGE_SIZE + 1)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(10000)).toBe(MAX_PAGE_SIZE);
  });

  it('fallback 可由调用方覆盖', () => {
    expect(clampPageSize(0, 20)).toBe(20);
  });
});

describe('clampOffset —— 组合边界', () => {
  it('page=1, pageSize=10 → offset=0', () => {
    expect(clampOffset(1, 10)).toBe(0);
  });

  it('常规 page/pageSize 计算正确', () => {
    expect(clampOffset(2, 10)).toBe(10);
    expect(clampOffset(5, 20)).toBe(80);
  });

  it('超大 page 但 pageSize 受限 → offset 仍可能未到 MAX_OFFSET', () => {
    // page=100000, pageSize=10 → 999_990，未超过 1_000_000
    expect(clampOffset(MAX_PAGE, 10)).toBe((MAX_PAGE - 1) * 10);
  });

  it('超大 page + pageSize=100 → offset 截断到 MAX_OFFSET', () => {
    // page=100000, pageSize=100 → 99_999_00，远超 1_000_000
    expect(clampOffset(MAX_PAGE, MAX_PAGE_SIZE)).toBe(MAX_OFFSET);
  });

  it('page=1e10 用 clampPage 兜底到 MAX_PAGE', () => {
    // page=1e10 → clampPage → MAX_PAGE=100000
    // offset = (100000-1)*10 = 999_990 < MAX_OFFSET，所以最终就是 999990
    expect(clampOffset(1e10, 10)).toBe((MAX_PAGE - 1) * 10);
  });

  it('page=1e10 + pageSize=100 → offset 截断到 MAX_OFFSET', () => {
    // page=1e10 → 100000; offset = (100000-1)*100 = 9_999_900 > MAX_OFFSET
    expect(clampOffset(1e10, 100)).toBe(MAX_OFFSET);
  });

  it('pageSize=0 用 clampPageSize 兜底成 10 → offset = (page-1)*10', () => {
    expect(clampOffset(3, 0)).toBe(20);
  });

  it('负数 page 用 clampPage 兜底到 1 → offset=0', () => {
    expect(clampOffset(-5, 10)).toBe(0);
  });
});

describe('applyPagination —— helper 透传语义', () => {
  /**
   * 构造一个最小的链式 builder mock，全部返回自身以模拟 Drizzle 的
   * `.limit()` / `.offset()` 链式调用。
   */
  function makeQueryMock() {
    const limit = vi.fn();
    const offset = vi.fn();
    const query: any = { limit, offset };
    limit.mockReturnValue(query);
    offset.mockReturnValue(query);
    return { query, limit, offset };
  }

  it('page=1, pageSize=10 → limit=10, offset=0', () => {
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { page: 1, pageSize: 10 });
    expect(limit).toHaveBeenCalledWith(10);
    expect(offset).toHaveBeenCalledWith(0);
  });

  it('page=3, pageSize=20 → limit=20, offset=40', () => {
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { page: 3, pageSize: 20 });
    expect(limit).toHaveBeenCalledWith(20);
    expect(offset).toHaveBeenCalledWith(40);
  });

  it('非法 page（NaN）→ 兜底成 1，offset=0', () => {
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { page: NaN, pageSize: 10 });
    expect(limit).toHaveBeenCalledWith(10);
    expect(offset).toHaveBeenCalledWith(0);
  });

  it('pageSize > MAX_PAGE_SIZE → 截断到 100', () => {
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { page: 1, pageSize: 10000 });
    expect(limit).toHaveBeenCalledWith(MAX_PAGE_SIZE);
    expect(offset).toHaveBeenCalledWith(0);
  });

  it('超大 page × pageSize → offset 截断到 MAX_OFFSET', () => {
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { page: MAX_PAGE, pageSize: MAX_PAGE_SIZE });
    expect(offset).toHaveBeenCalledWith(MAX_OFFSET);
  });

  it('page 为字符串数字 → 正常转换', () => {
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { page: '2', pageSize: '15' });
    expect(limit).toHaveBeenCalledWith(15);
    expect(offset).toHaveBeenCalledWith(15);
  });

  it('page 缺失/undefined → 兜底成 1', () => {
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { pageSize: 20 });
    expect(offset).toHaveBeenCalledWith(0);
  });

  it('pageSize 缺失/undefined → 兜底成 10', () => {
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { page: 5 });
    expect(limit).toHaveBeenCalledWith(10);
    expect(offset).toHaveBeenCalledWith(40);
  });

  it('返回的是同一 builder（链式调用约定）', () => {
    const { query, limit, offset } = makeQueryMock();
    const result = applyPagination(query, { page: 1, pageSize: 10 });
    expect(result).toBe(query);
    expect(limit).toHaveBeenCalledTimes(1);
    expect(offset).toHaveBeenCalledTimes(1);
  });

  it('不接受额外字段（TypeScript 编译时拒绝，运行时透传多余字段到 pageSize 不变）', () => {
    // 这里只用运行时断言：因为 input 类型 `{ page, pageSize }` 是闭合的，
    // 编译时多字段会报错。运行时多字段不会影响行为（多余的字段被忽略）。
    const { query, limit, offset } = makeQueryMock();
    applyPagination(query, { page: 2, pageSize: 10, flag: true } as any);
    expect(limit).toHaveBeenCalledWith(10);
    expect(offset).toHaveBeenCalledWith(10);
  });
});
