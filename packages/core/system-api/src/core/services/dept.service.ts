/**
 * 部门业务逻辑服务
 */

import { DeptRepository, CreateDeptInput, UpdateDeptInput } from "../repositories/dept.repository.js";
import { DeptMapper } from "../mappers/dept.mapper.js";
import { CreateDeptReq, DeptListQuery, SysDeptResp, UpdateDeptReq } from "../schemas/department.js";
import { BusinessError } from "@yishan/core-api/errors";
import { DeptErrorCode } from "@yishan/core-api/business-codes/dept";
import { UserService } from './user.service.js';
import { currentSystemRuntime } from '../../runtime.js';
import type { AppQueryDb } from '../../db/index.js';
import { CreateDeptFieldsSchema } from '../schemas/department.js';
import { Value } from '@sinclair/typebox/value';

export class DeptService {
  static async validateCreateReferences(fields: { parentId?: unknown; leaderId?: unknown }): Promise<void> {
    if (fields.parentId !== undefined && fields.parentId !== 0) {
      if (typeof fields.parentId !== 'number' || !Number.isInteger(fields.parentId) || fields.parentId < 1 || !await DeptRepository.findById(fields.parentId)) {
        throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, '上级部门不存在');
      }
    }
    if (fields.leaderId !== undefined && fields.leaderId !== 0) {
      if (typeof fields.leaderId !== 'number' || !Number.isInteger(fields.leaderId) || fields.leaderId < 1 || !await UserService.getUserById(fields.leaderId)) {
        throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, '负责人不存在或不在数据范围内');
      }
    }
  }
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
    const submission = req.draftSubmission;
    if (!submission) return this.createFields(req, operatorId);
    const participant = currentSystemRuntime().options.departmentCreationParticipant;
    if (!participant) throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, '当前部署不支持草稿提交');
    let claimed = false;
    try {
      return await DeptRepository.transaction(async tx => {
        const claim = await participant.claim(tx, operatorId, submission);
        claimed = true;
        if (claim.kind === 'replay') {
          const existing = await DeptRepository.findById(claim.departmentId, tx);
          if (!existing) throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, '已创建的部门不存在');
          return DeptMapper.toResp(existing);
        }
        const fields = claim.fields;
        for (const key of Object.keys(CreateDeptFieldsSchema.properties) as (keyof typeof CreateDeptFieldsSchema.properties)[]) {
          if (req[key] !== undefined && req[key] !== fields[key]) throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, `提交的数据与服务端草稿不一致：${key}`);
        }
        if (!Value.Check(CreateDeptFieldsSchema, fields)) throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, '部门草稿字段格式不正确');
        const created = await this.createFields(fields, operatorId, tx);
        await participant.complete(tx, operatorId, submission, created);
        return created;
      });
    } catch (error) {
      if (claimed && participant.fail) {
        try { await participant.fail({ actorId: operatorId, submission, reason: '部门创建失败，请检查表单后重试' }); } catch { /* Preserve the original business error. */ }
      }
      throw error;
    }
  }

  private static async createFields(req: CreateDeptReq, operatorId: number, db?: AppQueryDb): Promise<SysDeptResp> {
    await this.validateCreateReferences(req);
    await this.ensureUnique(req.name, undefined, db);

    const input: CreateDeptInput = {
      name: req.name,
      parentId: normalizeParentId(req.parentId),
      status: req.status ? parseInt(req.status, 10) : 1,
      sortOrder: req.sort_order ?? 0,
      description: req.description,
      leaderId: req.leaderId ?? null,
      creatorId: operatorId,
      updaterId: operatorId,
    };

    const dept = await DeptRepository.create(input, db);
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
    if (req.parentId !== undefined) input.parentId = normalizeParentId(req.parentId);
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
  private static async ensureUnique(name?: string, excludeId?: number, db?: AppQueryDb): Promise<void> {
    if (!name) return;
    const dup = await DeptRepository.findByName(name, db);
    if (dup && dup.id !== excludeId) {
      throw new BusinessError(DeptErrorCode.DEPT_ALREADY_EXISTS, "部门名称已存在");
    }
  }
}

/**
 * 把原生表单的「根」哨兵值归一成数据库的 NULL。
 *
 * 表单控件在没有父部门时给出 `0`，而树形结构里根节点是 `parent_id IS NULL`。用
 * `??` 归一不了 0（`0 ?? null` 还是 0），新部门会带着 parentId=0 落库，之后既挂不到
 * 任何真实父节点下，也不会出现在根列表里 —— 表现为「建完部门在树上找不到」。
 *
 * 与 validateCreateReferences 对 0 的判定保持一致：0 表示"没有父部门"，其余值必须
 * 是已存在的部门 id。
 */
function normalizeParentId(parentId: number | null | undefined): number | null {
  return parentId ? parentId : null;
}
