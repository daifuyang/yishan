/**
 * sys_region 种子入口。
 *
 * 数据源：modood/Administrative-divisions-of-China/dist/pca-code.json（WTFPL）
 * 写入策略：
 *   - 单条多值 INSERT + 按 `code` 主键 upsert，主键冲突由
 *     sql.raw('VALUES(col)') 引用本行刚 INSERT 的新值
 *   - code 规范化：
 *       省  "11"     -> 110000
 *       市  "1101"   -> 110100
 *       区  "110101" -> 110101（已是 6 位不补零）
 *   - 不带审计列（sys_region 没有 creator_id / updater_id），所以不需要 adminUserId
 *
 * 历史背景：早期曾有独立 runner apps/yishan-api/src/scripts/import-regions.ts
 * （commit b0d8774 引入、59ec692 删除），其 normalizeCode / flattenRegions
 * 规则被这里沿用——本文件把它接进 core seed 事务，使其随 db:seed 自动跑。
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { sql } from 'drizzle-orm';
import { sysRegion } from '@/db/schema';
import type { SeedDb } from '../context.js';

export type PcaNode = {
  code: string;
  name: string;
  children?: PcaNode[];
};

export type RegionRecord = {
  code: number;
  name: string;
  level: number;
  parentCode: number;
  sortOrder: number;
  status: number;
};

/**
 * 把统计代码补齐成 6 位整数主键。
 * 历史 runner (import-regions.ts, 已在 59ec692 中删除) 的规则。
 */
export function normalizeCode(code: string, level: number): number {
  if (level === 1) return Number(code) * 10000;
  if (level === 2) return Number(code) * 100;
  return Number(code);
}

/** 递归铺平省/市/区三级嵌套树。 */
export function flattenRegions(
  nodes: PcaNode[],
  level = 1,
  parentCode = 0,
): RegionRecord[] {
  const rows: RegionRecord[] = [];
  nodes.forEach((node, index) => {
    const code = normalizeCode(node.code, level);
    rows.push({
      code,
      name: node.name,
      level,
      parentCode,
      sortOrder: index,
      status: 1,
    });
    if (Array.isArray(node.children) && level < 3) {
      rows.push(...flattenRegions(node.children, level + 1, code));
    }
  });
  return rows;
}

/**
 * 加载 pca-code.json。
 *
 * 候选位置（按顺序尝试）：
 *   1. `<appRoot>/dist/scripts/seed/config/pca-code.json` — 编译后 + 已被 cp
 *   2. `<appRoot>/src/scripts/seed/config/pca-code.json`  — tsc 不会自动 cp JSON
 *      到 dist，pca-code.json 又超出其它 seed JSON 的 import-chain（后者通过
 *      `require('./config/<name>.json')` 在编译时 inline 到 .js，但 unit test
 *      / dev 路径下文件仍是 Node require 加载），所以兜底回 src/。
 *
 * appRoot 由 `../../../package.json` 推断：编译后在 dist/scripts/seed/modules/，
 * 与 src/ 同级。
 */
async function loadPcaData(): Promise<PcaNode[]> {
  const fileName = 'pca-code.json';
  const here = __dirname; // dist/scripts/seed/modules/
  const packageJsonPath = join(here, '..', '..', '..', '..', 'package.json');
  const appRoot = dirname(packageJsonPath); // dist/scripts/seed/modules → apps/yishan-api
  const candidates = [
    join(appRoot, 'dist', 'scripts', 'seed', 'config', fileName),
    join(appRoot, 'src', 'scripts', 'seed', 'config', fileName),
  ];
  for (const candidate of candidates) {
    try {
      const text = await readFile(candidate, 'utf8');
      return JSON.parse(text) as PcaNode[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
  throw new Error(
    `pca-code.json 未找到。尝试过：\n${candidates.map((p) => `  - ${p}`).join('\n')}`,
  );
}

export async function seedRegions(db: SeedDb): Promise<void> {
  const data = await loadPcaData();
  const rows = flattenRegions(data);

  // MySQL `INSERT ... ON DUPLICATE KEY UPDATE` 按 `code` 主键 upsert。
  // UPDATE 子句用 sql.raw 拼 `VALUES(col)` 字面量——这是 MySQL 多值 INSERT
  // + 同表 UPSERT 的标准语法，引用本行刚 INSERT 的新值。
  await db
    .insert(sysRegion)
    .values(rows)
    .onDuplicateKeyUpdate({
      set: {
        name: sql.raw('VALUES(`name`)'),
        level: sql.raw('VALUES(`level`)'),
        parentCode: sql.raw('VALUES(`parent_code`)'),
        sortOrder: sql.raw('VALUES(`sort_order`)'),
        status: sql.raw('VALUES(`status`)'),
      },
    });

  console.log(`省市区数据导入完成: ${rows.length} 条`);
}
