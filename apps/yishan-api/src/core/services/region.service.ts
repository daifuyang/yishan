import { RegionRepository, type RegionRow } from "../repositories/region.repository.js";

export type RegionNode = {
  code: number;
  name: string;
  level: number;
  parentCode: number;
  sortOrder: number;
  children?: RegionNode[];
};

const toRegionNode = (row: RegionRow): RegionNode => ({
  code: row.code,
  name: row.name,
  level: row.level,
  parentCode: row.parentCode,
  sortOrder: row.sortOrder,
});

export class RegionService {
  static async listByParent(parentCode = 0) {
    const rows = await RegionRepository.listActiveByParent(parentCode);
    return rows.map(toRegionNode);
  }

  static async getRegion(code: number) {
    const row = await RegionRepository.findByCode(code);
    return row ? toRegionNode(row) : null;
  }

  static async getPath(code: number) {
    const rows = await RegionRepository.getAncestorPath(code);
    return rows.map(toRegionNode);
  }

  static async getTree(maxLevel = 3) {
    const normalizedMaxLevel = Math.min(Math.max(Number(maxLevel) || 3, 1), 3);
    const rows = await RegionRepository.listActiveByMaxLevel(normalizedMaxLevel);

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