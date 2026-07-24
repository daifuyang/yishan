/**
 * sys_region seed 单元测试。
 *
 * 测的是模块导出的纯函数 normalizeCode / flattenRegions；
 * 不连真实 DB，只覆盖"树 → rows"的转换语义。seedRegions 整体的 upsert
 * 由端到端 `pnpm db:seed` 验证。
 */
import { describe, expect, it } from 'vitest';
import {
  flattenRegions,
  normalizeCode,
  type PcaNode,
} from '../src/scripts/seed/modules/system-region.js';

describe('normalizeCode', () => {
  it('补齐省级 code（2 位 × 10000）', () => {
    expect(normalizeCode('11', 1)).toBe(110000);
    expect(normalizeCode('65', 1)).toBe(650000); // 新疆
  });

  it('补齐市级 code（4 位 × 100）', () => {
    expect(normalizeCode('1101', 2)).toBe(110100);
    expect(normalizeCode('6501', 2)).toBe(650100); // 乌鲁木齐市
  });

  it('保留区/县级 code（已是 6 位）', () => {
    expect(normalizeCode('110101', 3)).toBe(110101);
    expect(normalizeCode('110108', 3)).toBe(110108);
  });
});

describe('flattenRegions', () => {
  it('单层（只有省级）→ 1 行', () => {
    const tree: PcaNode[] = [{ code: '11', name: '北京市' }];
    expect(flattenRegions(tree)).toEqual([
      {
        code: 110000,
        name: '北京市',
        level: 1,
        parentCode: 0,
        sortOrder: 0,
        status: 1,
      },
    ]);
  });

  it('省→市两层 → 3 行（1 省 + 2 市）', () => {
    const tree: PcaNode[] = [
      {
        code: '11',
        name: '北京市',
        children: [
          { code: '1101', name: '市辖区' },
          { code: '1102', name: '县', children: [] }, // 空 children 不报错
        ],
      },
    ];
    const rows = flattenRegions(tree);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      code: 110000, name: '北京市', level: 1, parentCode: 0, sortOrder: 0,
    });
    expect(rows[1]).toMatchObject({
      code: 110100, name: '市辖区', level: 2, parentCode: 110000, sortOrder: 0,
    });
    expect(rows[2]).toMatchObject({
      code: 110200, name: '县', level: 2, parentCode: 110000, sortOrder: 1,
    });
  });

  it('省→市→区三层 → 完整父子层级', () => {
    const tree: PcaNode[] = [
      {
        code: '11',
        name: '北京市',
        children: [
          {
            code: '1101',
            name: '市辖区',
            children: [
              { code: '110101', name: '东城区' },
              { code: '110102', name: '西城区' },
            ],
          },
        ],
      },
    ];
    const rows = flattenRegions(tree);
    expect(rows).toHaveLength(4);
    // 北京市
    expect(rows[0]).toMatchObject({ code: 110000, level: 1, parentCode: 0 });
    // 市辖区
    expect(rows[1]).toMatchObject({ code: 110100, level: 2, parentCode: 110000 });
    // 东城区/西城区
    expect(rows[2]).toMatchObject({ code: 110101, level: 3, parentCode: 110100, sortOrder: 0 });
    expect(rows[3]).toMatchObject({ code: 110102, level: 3, parentCode: 110100, sortOrder: 1 });
  });

  it('空 children 数组不应抛错', () => {
    const tree: PcaNode[] = [
      { code: '11', name: '北京市', children: [] },
      { code: '65', name: '新疆', children: undefined },
    ];
    expect(flattenRegions(tree)).toHaveLength(2);
  });
});
