import { prisma } from '../../utils/prisma.js';

export type RegionNode = {
  code: number;
  name: string;
  level: number;
  parentCode: number;
  sortOrder: number;
  children?: RegionNode[];
};

const toRegionNode = (row: any): RegionNode => ({
  code: row.code,
  name: row.name,
  level: row.level,
  parentCode: row.parentCode,
  sortOrder: row.sortOrder,
});

export class RegionService {
  static async listByParent(parentCode = 0) {
    const rows = await (prisma as any).sysRegion.findMany({
      where: { parentCode: Number(parentCode), status: 1 },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toRegionNode);
  }

  static async getRegion(code: number) {
    const row = await (prisma as any).sysRegion.findUnique({
      where: { code: Number(code) },
    });
    return row ? toRegionNode(row) : null;
  }

  static async getPath(code: number) {
    const path: RegionNode[] = [];
    let currentCode = Number(code);

    while (currentCode) {
      const row = await (prisma as any).sysRegion.findUnique({
        where: { code: currentCode },
      });
      if (!row) break;
      path.unshift(toRegionNode(row));
      currentCode = row.parentCode;
    }

    return path;
  }

  static async getTree(maxLevel = 3) {
    const normalizedMaxLevel = Math.min(Math.max(Number(maxLevel) || 3, 1), 3);
    const rows = await (prisma as any).sysRegion.findMany({
      where: { status: 1, level: { lte: normalizedMaxLevel } },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
    const nodeMap = new Map<number, RegionNode>();
    const roots: RegionNode[] = [];

    for (const row of rows) {
      nodeMap.set(row.code, toRegionNode(row));
    }

    for (const node of nodeMap.values()) {
      if (node.parentCode === 0) {
        roots.push(node);
        continue;
      }

      const parent = nodeMap.get(node.parentCode);
      if (!parent) continue;
      parent.children = parent.children || [];
      parent.children.push(node);
    }

    return roots;
  }
}
