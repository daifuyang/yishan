/**
 * 角色业务逻辑服务
 */

import { RoleRepository, CreateRoleInput, UpdateRoleInput } from "../repositories/role.repository.js";
import { RoleMapper } from "../mappers/role.mapper.js";
import { SaveRoleReq, RoleListQuery, SysRoleResp, UpdateRoleReq } from "../schemas/role.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { RoleErrorCode } from "../../constants/business-codes/role.js";
import { PermissionService } from "./permission.service.js";
import { getGlobalCatalog } from "./permission-catalog.service.js";
import { ROLE_CODES, SUPER_ADMIN_BYPASS } from "../../constants/permission-codes.js";
import { dbManager } from "@/db/manager";

export class RoleService {
  /** 获取角色列表 */
  static async getRoleList(query: RoleListQuery) {
    const safePage = Math.max(1, query.page || 1);
    const safePageSize = Math.max(1, Math.min(100, query.pageSize || 10));

    const list = await RoleRepository.list({
      ...query,
      status: query.status !== undefined ? parseInt(query.status as string, 10) : undefined,
      page: safePage,
      pageSize: safePageSize,
    });
    const total = await RoleRepository.count({
      keyword: query.keyword,
      status: query.status !== undefined ? parseInt(query.status as string, 10) : undefined,
    });

    return {
      list: list.map(RoleMapper.toListResp),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /** 获取角色详情 */
  static async getRoleById(id: number) {
    const role = await RoleRepository.findById(id);
    return role ? RoleMapper.toDetailResp(role) : null;
  }

  /** 创建角色（校验名称唯一） */
  static async createRole(req: SaveRoleReq, operatorId: number = 1): Promise<SysRoleResp> {
    await this.ensureUnique(req.name);
    await this.assertGrantablePermissionCodes(operatorId, req.permissionCodes);

    const input: CreateRoleInput = {
      name: req.name,
      description: req.description,
      status: req.status ? parseInt(req.status, 10) : 1,
      dataScope: req.dataScope ? parseInt(req.dataScope, 10) : 1,
      menuIds: req.menuIds,
      permissionCodes: req.permissionCodes,
      creatorId: operatorId,
      updaterId: operatorId,
    };

    const role = await dbManager.transaction((tx) => RoleRepository.create(input, tx));
    // Section 1 — RBAC：新建角色后失效全局权限缓存（无具体 roleIds 可清，全清）。
    RoleService.invalidatePermissionCache();
    return RoleMapper.toDetailResp(role);
  }

  /** 更新角色（校验名称唯一） */
  static async updateRole(id: number, req: UpdateRoleReq, operatorId: number = 1): Promise<SysRoleResp> {
    const existing = await RoleRepository.findById(id);
    if (!existing) {
      throw new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, "角色不存在");
    }

    if (req.name) {
      await this.ensureUnique(req.name, id);
    }
    await this.assertGrantablePermissionCodes(operatorId, req.permissionCodes);

    const input: UpdateRoleInput = {
      updaterId: operatorId,
    };

    if (req.name !== undefined) input.name = req.name;
    if (req.description !== undefined) input.description = req.description;
    if (req.status !== undefined) input.status = parseInt(req.status, 10);
    if (req.dataScope !== undefined) input.dataScope = parseInt(req.dataScope, 10);
    if (req.menuIds !== undefined) input.menuIds = req.menuIds;
    if (req.permissionCodes !== undefined) input.permissionCodes = req.permissionCodes;

    const role = await dbManager.transaction((tx) => RoleRepository.update(id, input, tx));
    // menuIds 变更直接影响该角色的权限集合；status 变更影响 disabled 过滤。
    RoleService.invalidatePermissionCache([id]);
    return RoleMapper.toDetailResp(role);
  }

  /** 删除角色 */
  static async deleteRole(id: number): Promise<{ id: number }> {
    const existing = await RoleRepository.findById(id);
    if (!existing) {
      throw new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, "角色不存在");
    }

    if (existing.isSystemDefault) {
      throw new BusinessError(RoleErrorCode.ROLE_DELETE_FORBIDDEN, "系统默认角色禁止删除");
    }

    const res = await RoleRepository.softDelete(id);
    if (!res) {
      throw new BusinessError(RoleErrorCode.ROLE_NOT_FOUND, "角色不存在或已删除");
    }
    RoleService.invalidatePermissionCache([id]);
    return { id };
  }

  /** 校验名称唯一性（排除自身） */
  private static async ensureUnique(name?: string, excludeId?: number): Promise<void> {
    if (!name) return;
    const dup = await RoleRepository.findByName(name);
    if (dup && dup.id !== excludeId) {
      throw new BusinessError(RoleErrorCode.ROLE_ALREADY_EXISTS, "角色名称已存在");
    }
  }

  /**
   * 防止“有角色编辑权就能给自己或他人授予任意能力”的越权。
   * 超级管理员可授予活动目录中的全部业务权限；其他操作者只能授予自己已有的权限。
   */
  private static async assertGrantablePermissionCodes(
    operatorId: number,
    requestedCodes: string[] | undefined,
  ): Promise<void> {
    if (requestedCodes === undefined) return;
    const activeCodes = await getGlobalCatalog().getActiveCodes();
    const normalizedCodes = [...new Set(requestedCodes)];
    const unknownCode = normalizedCodes.find((code) => !activeCodes.has(code));
    if (unknownCode) {
      throw new BusinessError(RoleErrorCode.ROLE_PERMISSION_INVALID, `权限码不存在、未启用或不可授权: ${unknownCode}`);
    }

    const roleIds = await PermissionService.loadRoleIdsForUser(operatorId);
    const { perms, roleCodes } = await PermissionService.loadForRoleIds(roleIds);
    if (roleCodes.has(ROLE_CODES.SUPER_ADMIN) || perms.has(SUPER_ADMIN_BYPASS)) return;

    const unauthorizedCode = normalizedCodes.find((code) => !perms.has(code));
    if (unauthorizedCode) {
      throw new BusinessError(RoleErrorCode.ROLE_PERMISSION_FORBIDDEN, `不能授予当前操作者未拥有的权限: ${unauthorizedCode}`);
    }
  }

  /**
   * 角色变更后失效 PermissionService 缓存。失败仅记录 warn，不影响主流程。
   */
  private static invalidatePermissionCache(roleIds?: number[]): void {
    try {
      PermissionService.invalidate(roleIds);
    } catch (err) {
      console.warn(
        "[role.service] invalidate permission cache failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
