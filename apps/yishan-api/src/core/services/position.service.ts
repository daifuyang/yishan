import { SysPositionRepository, type PositionListQuery, type CreatePositionInput, type UpdatePositionInput } from "../repositories/position.repository.js";
import { SysPositionMapper } from "../mappers/position.mapper.js";
import { PositionErrorCode } from "../../constants/business-codes/position.js";
import { ValidationErrorCode } from "../../constants/business-codes/validation.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { SavePositionReq, SysPositionResp, UpdatePositionReq } from "../schemas/position.js";

export class PositionService {
  static async getPositionList(query: PositionListQuery) {
    const { rows, total } = await SysPositionRepository.list(query);
    return {
      list: rows.map((r) => SysPositionMapper.toResp(r)),
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getPositionById(id: number): Promise<SysPositionResp> {
    const row = await SysPositionRepository.findById(id);
    if (!row) throw new BusinessError(PositionErrorCode.POSITION_NOT_FOUND, "岗位不存在");
    return SysPositionMapper.toResp(row);
  }

  static async createPosition(req: SavePositionReq): Promise<SysPositionResp> {
    const dupe = await SysPositionRepository.findByName(req.name);
    if (dupe) throw new BusinessError(PositionErrorCode.POSITION_ALREADY_EXISTS, "岗位名称已存在");

    const input: CreatePositionInput = {
      name: req.name,
      status: req.status !== undefined ? Number(req.status) : undefined,
      sortOrder: req.sort_order,
      description: req.description,
      creatorId: 1,
      updaterId: 1,
    };
    const row = await SysPositionRepository.create(input);
    if (!row) throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "创建失败");
    return SysPositionMapper.toResp(row);
  }

  static async updatePosition(id: number, req: UpdatePositionReq): Promise<SysPositionResp> {
    const existing = await SysPositionRepository.findById(id);
    if (!existing) throw new BusinessError(PositionErrorCode.POSITION_NOT_FOUND, "岗位不存在");

    if (req.name && req.name !== existing.name) {
      const dupe = await SysPositionRepository.findByName(req.name, id);
      if (dupe) throw new BusinessError(PositionErrorCode.POSITION_ALREADY_EXISTS, "岗位名称已存在");
    }

    const input: UpdatePositionInput = {
      name: req.name,
      status: req.status !== undefined ? Number(req.status) : undefined,
      sortOrder: req.sort_order,
      description: req.description,
      updaterId: 1,
    };
    const row = await SysPositionRepository.update(id, input);
    if (!row) throw new BusinessError(PositionErrorCode.POSITION_NOT_FOUND, "岗位不存在");
    return SysPositionMapper.toResp(row);
  }

  static async deletePosition(id: number): Promise<{ id: number }> {
    const existing = await SysPositionRepository.findById(id);
    if (!existing) throw new BusinessError(PositionErrorCode.POSITION_NOT_FOUND, "岗位不存在");
    if (existing.name === "超级管理员") {
      throw new BusinessError(PositionErrorCode.POSITION_DELETE_FORBIDDEN, "系统默认岗位不允许删除");
    }
    const ok = await SysPositionRepository.softDelete(id);
    if (!ok) throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "删除失败");
    return { id };
  }
}
