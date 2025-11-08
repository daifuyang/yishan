/**
 * 角色业务逻辑服务
 */

import { SysRoleModel } from "../models/sys-role.model.js";
import { SaveRoleReq, RoleListQuery, SysRoleResp, UpdateRoleReq } from "../schemas/role.js";
import { RoleErrorCode } from "../constants/business-codes/role.js";
import { BusinessError } from "../exceptions/business-error.js";

export class RoleService {
  /**
   * 获取角色列表
   */
  static async getRoleList(query: RoleListQuery) {
    const list = await SysRoleModel.getRoleList(query);
    const total = await SysRoleModel.getRoleTotal(query);

    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  /** 获取角色详情 */
  static async getRoleById(id: number) {
    return await SysRoleModel.getRoleById(id);
  }

  /** 创建角色（校验名称唯一） */
  static async createRole(req: SaveRoleReq): Promise<SysRoleResp> {
    await this.ensureUniqueName(req.name);
    return await SysRoleModel.createRole(req);
  }

  /** 更新角色（校验名称唯一） */
  static async updateRole(id: number, req: UpdateRoleReq): Promise<SysRoleResp> {
    const existing = await SysRoleModel.getRoleById(id);
    if (!existing) {
      throw new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, "角色不存在");
    }

    if (req.name) {
      await this.ensureUniqueName(req.name, id);
    }

    return await SysRoleModel.updateRole(id, req);
  }

  /** 删除角色（软删除） */
  static async deleteRole(id: number): Promise<{ id: number }> {
    const existing = await SysRoleModel.getRoleById(id);
    if (!existing) {
      throw new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, "角色不存在");
    }
    // 系统默认角色不允许删除
    if (existing.isSystemDefault) {
      throw new BusinessError(RoleErrorCode.ROLE_DELETE_FORBIDDEN, "系统默认角色不允许删除");
    }
    const res = await SysRoleModel.deleteRole(id);
    if (!res) {
      throw new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, "角色不存在或已删除");
    }
    return res;
  }

  /** 校验角色名称唯一性 */
  private static async ensureUniqueName(name: string, excludeRoleId?: number): Promise<void> {
    const roleWithSameName = await SysRoleModel.getRoleByName(name);
    if (roleWithSameName && roleWithSameName.id !== excludeRoleId) {
      throw new BusinessError(RoleErrorCode.ROLE_ALREADY_EXISTS, "角色名称已存在");
    }
  }
}