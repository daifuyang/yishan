/**
 * 部门业务逻辑服务
 */

import { DeptRepository, CreateDeptInput, UpdateDeptInput } from "../repositories/dept.repository.js";
import { DeptMapper } from "../mappers/dept.mapper.js";
import { CreateDeptReq, DeptListQuery, SysDeptResp, UpdateDeptReq } from "../schemas/department.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { DeptErrorCode } from "../../constants/business-codes/dept.js";

export class DeptService {
  /** 获取部门列表 */
  static async getDeptList(query: DeptListQuery) {
    const safePage = Math.max(1, query.page || 1);
    const safePageSize = Math.max(0, Math.min(100, query.pageSize || 10));

    const list = await DeptRepository.list({
      page: safePage,
      pageSize: safePageSize,
      keyword: query.keyword,
      status: query.status ? parseInt(query.status, 10) : undefined,
      parentId: query.parentId,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    const total = await DeptRepository.count({
      keyword: query.keyword,
      status: query.status ? parseInt(query.status, 10) : undefined,
      parentId: query.parentId,
    });

    return {
      list: list.map(DeptMapper.toResp),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /** 获取部门详情 */
  static async getDeptById(id: number) {
    const dept = await DeptRepository.findById(id);
    return dept ? DeptMapper.toResp(dept) : null;
  }

  /** 创建部门（校验名称唯一） */
  static async createDept(req: CreateDeptReq, operatorId: number = 1): Promise<SysDeptResp> {
    await this.ensureUnique(req.name);

    const input: CreateDeptInput = {
      name: req.name,
      parentId: req.parentId ?? null,
      status: req.status ? parseInt(req.status, 10) : 1,
      sortOrder: req.sort_order ?? 0,
      description: req.description,
      leaderId: req.leaderId ?? null,
      creatorId: operatorId,
      updaterId: operatorId,
    };

    const dept = await DeptRepository.create(input);
    return DeptMapper.toResp(dept);
  }

  /** 更新部门（校验名称唯一） */
  static async updateDept(id: number, req: UpdateDeptReq, operatorId: number = 1): Promise<SysDeptResp> {
    const existing = await DeptRepository.findById(id);
    if (!existing) {
      throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, "部门不存在");
    }

    if (req.name) {
      await this.ensureUnique(req.name, id);
    }

    const input: UpdateDeptInput = {
      updaterId: operatorId,
    };

    if (req.name !== undefined) input.name = req.name;
    if (req.parentId !== undefined) input.parentId = req.parentId;
    if (req.status !== undefined) input.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) input.sortOrder = req.sort_order;
    if (req.description !== undefined) input.description = req.description;
    if (req.leaderId !== undefined) input.leaderId = req.leaderId;

    const dept = await DeptRepository.update(id, input);
    return DeptMapper.toResp(dept);
  }

  /** 删除部门（若存在子部门则禁止） */
  static async deleteDept(id: number): Promise<{ id: number }> {
    const existing = await DeptRepository.findById(id);
    if (!existing) {
      throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, "部门不存在");
    }

    // 检查是否存在子部门
    const childrenCount = await DeptRepository.count({ parentId: id });
    if (childrenCount > 0) {
      throw new BusinessError(DeptErrorCode.DEPT_DELETE_FORBIDDEN, "存在子部门，禁止删除");
    }

    const res = await DeptRepository.softDelete(id);
    if (!res) {
      throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, "部门不存在或已删除");
    }
    return res;
  }

  /** 获取部门树 */
  static async getDeptTree(rootId?: number | null): Promise<SysDeptResp[]> {
    const depts = await DeptRepository.getDeptTree(rootId);

    const nodeMap = new Map<number, SysDeptResp & { children: SysDeptResp[] | null }>();
    const roots: SysDeptResp[] = [];

    for (const d of depts) {
      const node = { ...DeptMapper.toResp(d), children: null };
      nodeMap.set(d.id, node);
    }

    for (const d of depts) {
      const node = nodeMap.get(d.id)!;
      const pid = d.parentId ?? null;
      const isRootMatch = rootId === undefined ? pid === null : pid === (rootId ?? null);
      if (isRootMatch) {
        roots.push(node);
      } else if (pid !== null) {
        const parentNode = nodeMap.get(pid);
        if (parentNode) {
          if (!parentNode.children) parentNode.children = [];
          parentNode.children.push(node);
        }
      }
    }

    return roots;
  }

  /** 校验名称唯一性（排除自身） */
  private static async ensureUnique(name?: string, excludeId?: number): Promise<void> {
    if (!name) return;
    const dup = await DeptRepository.findByName(name);
    if (dup && dup.id !== excludeId) {
      throw new BusinessError(DeptErrorCode.DEPT_ALREADY_EXISTS, "部门名称已存在");
    }
  }
}
