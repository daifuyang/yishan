/**
 * 部门业务逻辑服务
 */

import { SysDeptModel } from "../models/sys-dept.model.js";
import { SaveDeptReq, DeptListQuery, SysDeptResp, UpdateDeptReq } from "../schemas/department.js";
import { BusinessError } from "../exceptions/business-error.js";
import { DeptErrorCode } from "../constants/business-codes/dept.js";

export class DeptService {
  /** 获取部门列表 */
  static async getDeptList(query: DeptListQuery) {
    const list = await SysDeptModel.getDeptList(query);
    const total = await SysDeptModel.getDeptTotal(query);

    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  /** 获取部门详情 */
  static async getDeptById(id: number) {
    return await SysDeptModel.getDeptById(id);
  }

  /** 创建部门（校验名称/编码唯一） */
  static async createDept(req: SaveDeptReq): Promise<SysDeptResp> {
    await this.ensureUnique(req.name, req.code);
    return await SysDeptModel.createDept(req);
  }

  /** 更新部门（校验名称/编码唯一） */
  static async updateDept(id: number, req: UpdateDeptReq): Promise<SysDeptResp> {
    const existing = await SysDeptModel.getDeptById(id);
    if (!existing) {
      throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, "部门不存在");
    }

    if (req.name || req.code) {
      await this.ensureUnique(req.name, req.code, id);
    }

    return await SysDeptModel.updateDept(id, req);
  }

  /** 删除部门（若存在子部门则禁止） */
  static async deleteDept(id: number): Promise<{ id: number }> {
    const existing = await SysDeptModel.getDeptById(id);
    if (!existing) {
      throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, "部门不存在");
    }

    // 检查是否存在子部门
    const childrenCount = await SysDeptModel.getDeptTotal({ page: 1, pageSize: 1, parentId: id } as any);
    if (childrenCount > 0) {
      throw new BusinessError(DeptErrorCode.DEPT_DELETE_FORBIDDEN, "存在子部门，禁止删除");
    }

    const res = await SysDeptModel.deleteDept(id);
    if (!res) {
      throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, "部门不存在或已删除");
    }
    return res;
  }

  /** 校验名称与编码唯一性（排除自身） */
  private static async ensureUnique(name?: string, code?: string, excludeId?: number): Promise<void> {
    if (!name && !code) return;
    const dup = await SysDeptModel.getDeptByNameOrCode(name, code);
    if (dup && dup.id !== excludeId) {
      throw new BusinessError(DeptErrorCode.DEPT_ALREADY_EXISTS, "部门名称或编码已存在");
    }
  }
}