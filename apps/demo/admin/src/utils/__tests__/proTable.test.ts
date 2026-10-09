/**
 * ProTable 请求适配器单元测试。
 *
 * 验证：
 * 1. 完整信封 → data/success/total 正确解包。
 * 2. 缺失 pagination → total 走 0（**不能**退化为 data.length）。
 * 3. 缺失 data → 返回空数组，不抛错。
 * 4. success 缺失 → 退化为 true（避免 ProTable 误认失败）。
 * 5. fetcher 抛错 → 错误原样上抛，不吞。
 * 6. 入参原样透传给 fetcher。
 */

import { createProTableRequest } from '@/utils/proTable';

describe('createProTableRequest —— ProTable 信封适配器', () => {
  it('完整信封：data/success/total 正确解包', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      success: true,
      code: 0,
      message: 'ok',
      data: [{ id: 1, name: 'a' }],
      pagination: { total: 42 },
    });
    const request = createProTableRequest(fetcher);

    const result = await request({ page: 1, pageSize: 10 });

    expect(result).toEqual({
      data: [{ id: 1, name: 'a' }],
      success: true,
      total: 42,
    });
  });

  it('缺失 pagination 时 total 走 0（不能用 data.length 假装）', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      success: true,
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    const request = createProTableRequest(fetcher);

    const result = await request({});

    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(3);
  });

  it('缺失 data 时返回空数组，不抛错', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      success: true,
      pagination: { total: 0 },
    });
    const request = createProTableRequest(fetcher);

    const result = await request({});

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('success 缺失时退化为 true（避免 ProTable 误认失败）', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      data: [{ id: 1 }],
      pagination: { total: 1 },
    });
    const request = createProTableRequest(fetcher);

    const result = await request({});

    expect(result.success).toBe(true);
  });

  it('fetcher 抛错时错误原样上抛，不吞', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('network down'));
    const request = createProTableRequest(fetcher);

    await expect(request({})).rejects.toThrow('network down');
  });

  it('pagination.total 为 0 时不能被误当成"无数据"', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0 },
    });
    const request = createProTableRequest(fetcher);

    const result = await request({});

    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('入参原样透传给 fetcher，不窥探字段', async () => {
    // 适配器必须不假设 API 参数命名（doc §1.2 边界：不得猜测接口字段）。
    // 这里用一个非标准参数名 `currentPage` 的 fetcher 验证透传。
    const fetcher = jest.fn().mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0 },
    });
    const request = createProTableRequest(fetcher);

    const params = { currentPage: 1, pageSize: 10, filter: { name: 'x' } };
    await request(params);

    expect(fetcher).toHaveBeenCalledWith(params);
  });

  it('透传时 fetcher 引用未被改写', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0 },
    });
    const request = createProTableRequest(fetcher);

    const params = { a: 1, b: 2 };
    const result = await request(params);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(params);
    expect(result.success).toBe(true);
  });
});
