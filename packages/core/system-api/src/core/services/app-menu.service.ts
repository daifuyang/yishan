/**
 * App 工作台菜单业务逻辑服务（独立于 Web 的 sys_menu）
 */

import { BusinessError } from "@yishan/core-api/errors";
import { MenuErrorCode } from "@yishan/core-api/business-codes/menu";
import { dbManager } from "@/db";
import { dateUtils } from "../../utils/date.js";
import { ROLE_CODES } from "../../constants/permission-codes.js";
import {
  AppMenuRepository,
  type AppMenuPublicRow,
  type CreateAppMenuInput,
  type UpdateAppMenuInput,
} from "../repositories/app-menu.repository.js";
import type { AppMenuNode, ReorderAppMenuReq, SaveAppMenuReq, UpdateAppMenuReq } from "../schemas/app-menu.js";
import { PermissionService } from "./permission.service.js";

export const CORE_APP_MODULE_ID = "core";
const PAGE_PATTERN = /^pages\/[\w\-/]+$/;
const SORT_STEP = 10;

export interface AppMenuModuleScope {
  listModuleIds(): ReadonlySet<string>;
  enabledIdsCached(): Promise<ReadonlySet<string>>;
}

export class AppMenuService {
  /** 管理端：全量树（含禁用节点） */
  static async getTree(): Promise<AppMenuNode[]> {
    return buildTree((await AppMenuRepository.listAll()).map(toNode));
  }

  static async getById(id: number): Promise<AppMenuNode | null> {
    const row = await AppMenuRepository.findById(id);
    return row ? toNode(row) : null;
  }

  static async create(req: SaveAppMenuReq, operatorId: number = 1): Promise<AppMenuNode> {
    const type = req.type ?? 1;
    const parentId = type === 0 ? null : (req.parentId ?? null);
    const page = type === 1 ? normalizePage(req.page) : null;
    if (type === 0 && req.parentId != null) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "分组不能有上级");
    }
    await this.assertShape({ type, parentId, page });
    await this.assertUnique(req.name, parentId, page);

    const siblings = await AppMenuRepository.listChildren(parentId);
    const input: CreateAppMenuInput = {
      parentId,
      type,
      name: req.name,
      icon: req.icon ?? null,
      page,
      moduleId: req.moduleId ?? CORE_APP_MODULE_ID,
      sortOrder: req.sortOrder ?? nextSortOrder(siblings),
      status: req.status ? parseInt(req.status, 10) : 1,
      creatorId: operatorId,
    };
    return toNode(await AppMenuRepository.create(input));
  }

  static async update(id: number, req: UpdateAppMenuReq, operatorId: number = 1): Promise<AppMenuNode> {
    const existing = await AppMenuRepository.findById(id);
    if (!existing) throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "工作台菜单不存在");

    const type = req.type ?? existing.type;
    const parentId = req.parentId !== undefined ? req.parentId : existing.parentId;
    const page = req.page !== undefined ? normalizePage(req.page) : existing.page;
    const name = req.name ?? existing.name;

    if (type !== existing.type && (await AppMenuRepository.countChildren(id)) > 0) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "分组下存在应用入口，不能变更类型");
    }
    await this.assertShape({ type, parentId: type === 0 ? null : parentId, page, selfId: id });
    await this.assertUnique(name, type === 0 ? null : parentId, type === 1 ? page : null, id);

    const input: UpdateAppMenuInput = { updaterId: operatorId };
    if (req.name !== undefined) input.name = req.name;
    if (req.type !== undefined) input.type = req.type;
    if (req.parentId !== undefined || type === 0) input.parentId = type === 0 ? null : parentId;
    if (req.icon !== undefined) input.icon = req.icon;
    if (req.page !== undefined || type === 0) input.page = type === 1 ? page : null;
    if (req.moduleId !== undefined) input.moduleId = req.moduleId;
    if (req.sortOrder !== undefined) input.sortOrder = req.sortOrder;
    if (req.status !== undefined) input.status = parseInt(req.status, 10);

    return toNode(await AppMenuRepository.update(id, input));
  }

  /** 删除：分组下有入口时禁止；删除时同步清理角色授权 */
  static async delete(id: number): Promise<{ id: number }> {
    const existing = await AppMenuRepository.findById(id);
    if (!existing) throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "工作台菜单不存在");
    if ((await AppMenuRepository.countChildren(id)) > 0) {
      throw new BusinessError(MenuErrorCode.MENU_DELETE_FORBIDDEN, "分组下存在应用入口，禁止删除");
    }
    await dbManager.transaction(async (tx) => {
      await AppMenuRepository.deleteRoleLinks(id, tx);
      await AppMenuRepository.softDelete(id, tx);
    });
    return { id };
  }

  /** 同级重排：orderedIds 必须恰好是该层级全部节点 */
  static async reorder(req: ReorderAppMenuReq): Promise<{ count: number }> {
    const parentId = req.parentId ?? null;
    const siblings = await AppMenuRepository.listChildren(parentId);
    const expected = new Set(siblings.map((row) => row.id));
    const given = new Set(req.orderedIds);
    if (
      given.size !== req.orderedIds.length ||
      given.size !== expected.size ||
      req.orderedIds.some((id) => !expected.has(id))
    ) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "排序列表必须包含该层级的全部节点且不重复");
    }
    await dbManager.transaction((tx) => AppMenuRepository.writeOrder(req.orderedIds, tx));
    return { count: req.orderedIds.length };
  }

  /**
   * App 端：当前用户的工作台树。
   * 超管看全部；其余按角色授权并补齐祖先分组；停用或未挂载模块的入口被过滤，空分组被丢弃。
   */
  static async getAuthorizedTree(roleIds: number[], moduleScope?: AppMenuModuleScope): Promise<AppMenuNode[]> {
    const rows = await AppMenuRepository.listAll();
    const byId = new Map(rows.map((row) => [row.id, row]));

    const allow = new Set<number>();
    if (await hasSuperAdminRole(roleIds)) {
      for (const row of rows) allow.add(row.id);
    } else {
      for (const id of await AppMenuRepository.findIdsByRoleIds(roleIds)) {
        const visited = new Set<number>();
        let cur = byId.get(id);
        while (cur && !visited.has(cur.id)) {
          visited.add(cur.id);
          allow.add(cur.id);
          cur = cur.parentId == null ? undefined : byId.get(cur.parentId);
        }
      }
    }

    const activeModules = moduleScope ? await resolveActiveModules(moduleScope) : null;
    const visible = rows.filter((row) => {
      if (!allow.has(row.id) || row.status !== 1) return false;
      if (row.type === 1 && activeModules && row.moduleId !== CORE_APP_MODULE_ID && !activeModules.has(row.moduleId)) {
        return false;
      }
      return true;
    });

    const tree = buildTree(visible.map(toNode));
    return tree.filter((group) => group.type !== 0 || (group.children?.length ?? 0) > 0);
  }

  private static async assertShape(args: {
    type: number;
    parentId: number | null;
    page: string | null;
    selfId?: number;
  }): Promise<void> {
    const { type, parentId, page, selfId } = args;
    if (type === 0) return;
    if (parentId === null) throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "应用入口必须归属一个分组");
    if (selfId !== undefined && parentId === selfId) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "上级不允许指向自身");
    }
    const parent = await AppMenuRepository.findById(parentId);
    if (!parent || parent.type !== 0) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "所属分组不存在");
    }
    if (!page) throw new BusinessError(MenuErrorCode.MENU_INVALID_COMPONENT, "应用入口必须填写 App 页面路径");
    if (!PAGE_PATTERN.test(page)) {
      throw new BusinessError(
        MenuErrorCode.MENU_INVALID_COMPONENT,
        `App 页面路径不合法：${page}（形如 pages/contacts/index/index）`,
      );
    }
  }

  private static async assertUnique(
    name: string,
    parentId: number | null,
    page: string | null,
    excludeId?: number,
  ): Promise<void> {
    const dupName = await AppMenuRepository.findByParentAndName(parentId, name);
    if (dupName && dupName.id !== excludeId) {
      throw new BusinessError(MenuErrorCode.MENU_ALREADY_EXISTS, "同级下名称已存在");
    }
    if (page) {
      const dupPage = await AppMenuRepository.findByPage(page);
      if (dupPage && dupPage.id !== excludeId) {
        throw new BusinessError(MenuErrorCode.MENU_ALREADY_EXISTS, "该 App 页面已配置为工作台入口");
      }
    }
  }
}

function normalizePage(page: string | null | undefined): string | null {
  const trimmed = page?.trim().replace(/^\/+/, "");
  return trimmed ? trimmed : null;
}

function nextSortOrder(siblings: AppMenuPublicRow[]): number {
  const max = siblings.reduce((acc, row) => Math.max(acc, row.sortOrder), 0);
  return max + SORT_STEP;
}

async function hasSuperAdminRole(roleIds: number[]): Promise<boolean> {
  if (roleIds.length === 0) return false;
  const { roleCodes } = await PermissionService.loadForRoleIds(roleIds);
  return roleCodes.has(ROLE_CODES.SUPER_ADMIN);
}

async function resolveActiveModules(scope: AppMenuModuleScope): Promise<Set<string>> {
  const enabled = await scope.enabledIdsCached();
  const mounted = scope.listModuleIds();
  return new Set([...enabled].filter((id) => mounted.has(id)));
}

function toNode(row: AppMenuPublicRow): AppMenuNode {
  return {
    id: row.id,
    parentId: row.parentId ?? undefined,
    type: row.type,
    name: row.name,
    icon: row.icon ?? undefined,
    page: row.page ?? undefined,
    moduleId: row.moduleId,
    sortOrder: row.sortOrder,
    status: String(row.status),
    createdAt: dateUtils.formatISO(row.createdAt)!,
    updatedAt: dateUtils.formatISO(row.updatedAt)!,
    children: null,
  };
}

/** 两级树；输入已按 sort_order, id 排序，保持稳定顺序 */
function buildTree(nodes: AppMenuNode[]): AppMenuNode[] {
  const map = new Map(nodes.map((node) => [node.id, node]));
  const roots: AppMenuNode[] = [];
  for (const node of nodes) {
    if (node.parentId == null) {
      roots.push(node);
      continue;
    }
    const parent = map.get(node.parentId);
    if (!parent) continue;
    if (!parent.children) parent.children = [];
    parent.children.push(node);
  }
  return roots;
}
