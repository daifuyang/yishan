import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { prismaManager } from '../utils/prisma.js';

const DEFAULT_SOURCE_URL =
  'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pca-code.json';

type PcaNode = {
  code: string;
  name: string;
  children?: PcaNode[];
};

type RegionRecord = {
  code: number;
  name: string;
  level: number;
  parentCode: number;
  sortOrder: number;
  status: number;
};

function normalizeCode(code: string, level: number) {
  if (level === 1) return Number(code) * 10000;
  if (level === 2) return Number(code) * 100;
  return Number(code);
}

function flattenRegions(nodes: PcaNode[], level = 1, parentCode = 0): RegionRecord[] {
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

async function loadSource() {
  const source = process.env.REGION_DATA_PATH || process.argv[2];
  if (source) {
    return readFile(source, 'utf8');
  }

  const response = await fetch(DEFAULT_SOURCE_URL);
  if (!response.ok) {
    throw new Error(`下载省市区数据失败: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function importRegions() {
  const raw = await loadSource();
  const data = JSON.parse(raw) as PcaNode[];
  const rows = flattenRegions(data);
  const prisma = prismaManager.getClient();

  for (const row of rows) {
    await (prisma as any).sysRegion.upsert({
      where: { code: row.code },
      update: {
        name: row.name,
        level: row.level,
        parentCode: row.parentCode,
        sortOrder: row.sortOrder,
        status: row.status,
      },
      create: row,
    });
  }

  console.log(`省市区数据导入完成: ${rows.length} 条`);
}

importRegions()
  .catch((error) => {
    console.error('省市区数据导入失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prismaManager.getClient().$disconnect();
  });
