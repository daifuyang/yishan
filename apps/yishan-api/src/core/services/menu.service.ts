/**
 * 菜单业务逻辑服务
 */

import { MenuRepository, CreateMenuInput, UpdateMenuInput } from "../repositories/menu.repository.js";
import { MenuMapper } from "../mappers/menu.mapper.js";
import { SaveMenuReq, MenuListQuery, SysMenuResp, UpdateMenuReq, MenuTreeNode } from "../schemas/menu.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { MenuErrorCode } from "../../constants/business-codes/menu.js";
import { PermissionService } from "./permission.service.js";
import { ROLE_CODES } from "../../constants/permission-codes.js";
import { getGlobalCatalog } from './permission-catalog.service.js';

export class MenuService {
  /** 获取菜单列表 */
  static async getMenuList(query: MenuListQuery) {
    const list = await MenuRepository.list({
      ...query,
      status: query.status !== undefined ? parseInt(query.status as string, 10) : undefined,
    });
    const total = await MenuRepository.count({
      keyword: query.keyword,
      status: query.status !== undefined ? parseInt(query.status as string, 10) : undefined,
      type: query.type,
      parentId: query.parentId,
    });

    return {
      list: await this.withPermissionCodes(list),
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  /** 获取菜单树 */
  static async getMenuTree(rootId?: number | null): Promise<MenuTreeNode[]> {
    const menus = await MenuRepository.listAllForTree();
    const mappedMenus = await this.withPermissionCodes(menus);
    return buildMenuTree(mappedMenus, rootId);
  }

  /** 获取授权菜单树 */
  static async getAuthorizedMenuTree(roleIds: number[]): Promise<MenuTreeNode[]> {
    const hasSuperAdminRole = await MenuService.hasSuperAdminRole(roleIds);
    const assignedMenuIds = await MenuRepository.findMenuIdsByRoleIds(roleIds);
    const menus = await MenuRepository.listAllForAuthorization();

    // 计算允许访问的菜单ID集合
    const allow = new Set<number>();
    if (hasSuperAdminRole) {
      for (const menu of menus) allow.add(menu.id);
    } else {
      const menuById = new Map(menus.map(m => [m.id, m]));
      for (const id of assignedMenuIds) {
        let cur = menuById.get(id);
        const visited = new Set<number>();
        while (cur) {
          if (visited.has(cur.id)) break;
          visited.add(cur.id);
          allow.add(cur.id);
          const pid = cur.parentId ?? null;
          if (pid === null) break;
          cur = menuById.get(pid);
        }
      }
    }

    // 过滤并构建树
    const filteredMenus = menus.filter(menu => allow.has(menu.id) && menu.status === 1);
    const mappedMenus = await this.withPermissionCodes(filteredMenus);
    return buildMenuTree(mappedMenus);
  }

  /** 获取授权菜单路径 */
  static async getAuthorizedMenuPaths(roleIds: number[]): Promise<string[]> {
    const hasSuperAdminRole = await MenuService.hasSuperAdminRole(roleIds);
    const assignedMenuIds = await MenuRepository.findMenuIdsByRoleIds(roleIds);
    const menuPaths = await MenuRepository.findAllMenuPaths();

    // 计算允许访问的菜单ID集合
    const allow = new Set<number>();
    if (hasSuperAdminRole) {
      for (const menu of menuPaths) allow.add(menu.id);
    } else {
      const menuById = new Map(menuPaths.map(m => [m.id, m]));
      for (const id of assignedMenuIds) {
        let cur = menuById.get(id);
        const visited = new Set<number>();
        while (cur) {
          if (visited.has(cur.id)) break;
          visited.add(cur.id);
          allow.add(cur.id);
          const pid = cur.parentId ?? null;
          if (pid === null) break;
          cur = menuById.get(pid);
        }
      }
    }

    // 收集路径
    const paths = new Set<string>();
    for (const id of allow) {
      const menu = menuPaths.find(m => m.id === id);
      if (!menu) continue;
      if (menu.path && !menu.isExternalLink) {
        paths.add(menu.path);
      }
    }
    return Array.from(paths);
  }

  /** 获取菜单详情 */
  static async getMenuById(id: number): Promise<SysMenuResp | null> {
    const menu = await MenuRepository.findById(id);
    return menu ? (await this.withPermissionCodes([menu]))[0] : null;
  }

  /** 创建菜单（校验名称/路径唯一 & 父级合法） */
  static async createMenu(req: SaveMenuReq, operatorId: number = 1): Promise<SysMenuResp> {
    await this.ensureUnique(req.name, req.parentId ?? null, req.path);
    await this.ensureParentValid(req.parentId, undefined);

    const input: CreateMenuInput = {
      name: req.name,
      type: req.type ?? 1,
      parentId: req.parentId ?? null,
      path: req.path,
      icon: req.icon,
      component: req.component,
      status: req.status ? parseInt(req.status, 10) : 1,
      sortOrder: req.sort_order ?? 0,
      hideInMenu: req.hideInMenu ?? false,
      isDefaultAction: req.isDefaultAction ?? false,
      isExternalLink: req.isExternalLink ?? false,
      keepAlive: req.keepAlive ?? false,
      creatorId: operatorId,
      updaterId: operatorId,
    };

    await this.assertPermissionCodes(req.permissionCodes, input.type ?? 1);
    const menu = await MenuRepository.create(input);
    await MenuRepository.replacePermissionCodes(menu.id, req.permissionCodes || []);
    // 菜单绑定仅决定角色编辑页中的功能归属，不直接授予后端权限。
    MenuService.invalidatePermissionCache();
    return (await this.withPermissionCodes([menu]))[0];
  }

  /** 更新菜单（校验名称/路径唯一 & 父级合法） */
  static async updateMenu(id: number, req: UpdateMenuReq, operatorId: number = 1): Promise<SysMenuResp> {
    const existing = await MenuRepository.findById(id);
    if (!existing) {
      throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "菜单不存在");
    }

    const targetParentId = req.parentId !== undefined ? (req.parentId ?? null) : (existing.parentId ?? null);
    const targetName = req.name ?? existing.name;
    const targetPath = req.path ?? (existing.path ?? undefined);

    await this.ensureUnique(targetName, targetParentId, targetPath, id);
    await this.ensureParentValid(req.parentId, id);

    const input: UpdateMenuInput = {
      updaterId: operatorId,
    };

    if (req.name !== undefined) input.name = req.name;
    if (req.type !== undefined) input.type = req.type;
    if (req.parentId !== undefined) input.parentId = req.parentId ?? null;
    if (req.path !== undefined) input.path = req.path;
    if (req.icon !== undefined) input.icon = req.icon;
    if (req.component !== undefined) input.component = req.component;
    if (req.status !== undefined) input.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) input.sortOrder = req.sort_order;
    if (req.hideInMenu !== undefined) input.hideInMenu = req.hideInMenu;
    if (req.isDefaultAction !== undefined) input.isDefaultAction = req.isDefaultAction;
    if (req.isExternalLink !== undefined) input.isExternalLink = req.isExternalLink;
    if (req.keepAlive !== undefined) input.keepAlive = req.keepAlive;

    await this.assertPermissionCodes(req.permissionCodes, req.type ?? existing.type);
    const menu = await MenuRepository.update(id, input);
    if (req.permissionCodes !== undefined) await MenuRepository.replacePermissionCodes(id, req.permissionCodes);
    // 功能归属更新不改变角色已持有的后端权限。
    MenuService.invalidatePermissionCache();
    return (await this.withPermissionCodes([menu]))[0];
  }

  /** 删除菜单（存在子菜单或已绑定角色则禁止） */
  static async deleteMenu(id: number): Promise<{ id: number }> {
    const existing = await MenuRepository.findById(id);
    if (!existing) {
      throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "菜单不存在");
    }

    // 检查是否存在子菜单
    const childrenCount = await MenuRepository.count({ parentId: id });
    if (childrenCount > 0) {
      throw new BusinessError(MenuErrorCode.MENU_DELETE_FORBIDDEN, "存在子菜单，禁止删除");
    }

    // 检查是否有角色绑定
    const roleBindCount = await MenuRepository.countByRoleMenu(id);
    if (roleBindCount > 0) {
      throw new BusinessError(MenuErrorCode.MENU_DELETE_FORBIDDEN, "该菜单已绑定角色，禁止删除");
    }

    const res = await MenuRepository.softDelete(id);
    if (!res) {
      throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "菜单不存在或已删除");
    }
    MenuService.invalidatePermissionCache();
    return { id };
  }

  /** 校验名称与路径唯一性（同父级下名称唯一，路径全局唯一；排除自身） */
  private static async ensureUnique(name: string, parentId: number | null, path?: string, excludeId?: number): Promise<void> {
    if (name) {
      const dupName = await MenuRepository.findByParentAndName(parentId, name);
      if (dupName && dupName.id !== excludeId) {
        throw new BusinessError(MenuErrorCode.MENU_ALREADY_EXISTS, "同父级下菜单名称已存在");
      }
    }

    if (path) {
      const dupPath = await MenuRepository.findByPath(path);
      if (dupPath && dupPath.id !== excludeId) {
        throw new BusinessError(MenuErrorCode.MENU_ALREADY_EXISTS, "菜单路径已存在");
      }
    }
  }

  /** 校验父级菜单合法性：存在且不为自身 */
  private static async ensureParentValid(parentId?: number, selfId?: number): Promise<void> {
    if (parentId === undefined || parentId === null) return;
    if (selfId !== undefined && parentId === selfId) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "父级菜单不允许指向自身");
    }
    const parent = await MenuRepository.findById(parentId);
    if (!parent) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "父级菜单不存在");
    }
  }

  private static async assertPermissionCodes(codes: string[] | undefined, menuType: number): Promise<void> {
    if (codes === undefined) return;
    if (menuType === 0 && codes.length > 0) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, '目录不能关联功能');
    }
    const activeCodes = await getGlobalCatalog().getActiveCodes();
    const unknownCode = codes.find((code) => !activeCodes.has(code));
    if (unknownCode) throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, `关联功能不存在或未启用: ${unknownCode}`);
  }

  private static async withPermissionCodes<T extends { id: number }>(menus: T[]): Promise<Array<T & SysMenuResp>> {
    const codesByMenuId = await MenuRepository.findPermissionCodesByMenuIds(menus.map((menu) => menu.id));
    return menus.map((menu) => ({
      ...MenuMapper.toListResp(menu as any),
      permissionCodes: codesByMenuId.get(menu.id) || [],
    })) as Array<T & SysMenuResp>;
  }

  /**
   * 判定一组角色中是否包含 super_admin（基于 role.code，禁止使用数据库 role ID）。
   */
  private static async hasSuperAdminRole(roleIds: number[]): Promise<boolean> {
    if (roleIds.length === 0) return false;
    const { roleCodes } = await PermissionService.loadForRoleIds(roleIds);
    return roleCodes.has(ROLE_CODES.SUPER_ADMIN);
  }

  /**
   * 菜单变更后失效 PermissionService 缓存。失败仅记录 warn，不影响主流程。
   */
  private static invalidatePermissionCache(): void {
    try {
      PermissionService.invalidate();
    } catch (err) {
      console.warn(
        "[menu.service] invalidate permission cache failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

/** 构建菜单树的辅助函数 */
function buildMenuTree(menus: SysMenuResp[], rootId?: number | null): MenuTreeNode[] {
  const nodeMap = new Map<number, MenuTreeNode>();
  const roots: MenuTreeNode[] = [];

  // 先创建所有节点
  for (const menu of menus) {
    nodeMap.set(menu.id, { ...menu, children: null });
  }

  // 然后构建父子关系
  for (const menu of menus) {
    const node = nodeMap.get(menu.id)!;
    const pid = menu.parentId ?? null;
    const isRootMatch = rootId === undefined ? pid === null : pid === (rootId ?? null);
    
    if (isRootMatch) {
      roots.push(node);
    } else if (pid !== null) {
      const parentNode = nodeMap.get(pid);
      if (parentNode) {
        if (!parentNode.children) parentNode.children = [];
        (parentNode.children as MenuTreeNode[]).push(node);
      }
    }
  }

  return roots;
}
