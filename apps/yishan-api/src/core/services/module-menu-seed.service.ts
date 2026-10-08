/**
 * module-menu-seed.service.ts — system 默认实现对模块开放的菜单登记能力。
 *
 * 模块在自己的 config/system-menu.json 中声明菜单树，seed 时调用 `seedModuleMenus`
 * 写入 sys_menu / sys_menu_permission。模块因此不需要知道 system 的表结构；替换 system
 * 的项目提供同名函数（或让模块 seed 跳过菜单）即可。经 `core/system-api.ts` 对模块公开。
 *
 * 行为（自 demo/seed.ts 收敛而来，保持不变）：
 *   - 按 path upsert 菜单节点（存在则更新名称、类型、父节点、组件、图标、排序、可见性）；
 *   - 无 path 的按钮节点不建行，其 permissionCodes 绑定到最近的有 path 的祖先；
 *   - 权限绑定按 (menu_id, permission_code) 幂等。
 */
import { eq } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "../../db/index.js";
import { sysMenu, sysMenuPermission, sysUser } from "../../db/schema/index.js";

/**
 * 模块菜单节点。JSON 中所有“是否”字段用 0/1。
 * 任何节点都可以挂 children（type=0 目录 / 1 页面 / 2 按钮都允许嵌套）。
 */
export type ModuleMenuNode = {
  type: 0 | 1 | 2;
  name: string;
  path?: string;
  sortOrder: number;
  icon?: string;
  component?: string;
  hideInMenu?: 0 | 1;
  permissionCodes?: string[];
  isDefaultAction?: 0 | 1;
  children?: ModuleMenuNode[];
};

/** 把 0/1 转成布尔（DB schema 用 0/1，这里只是中转） */
export const toBool = (n: 0 | 1 | undefined): boolean => n === 1;

export type FlatMenuNode = {
  node: ModuleMenuNode;
  depth: number;
  /** 最近的有 path 的祖先 path（按钮的权限码绑到这）；顶级为 null。 */
  parentPath: string | null;
};

/**
 * 把菜单树递归铺平成「插入顺序」的节点列表，保留层数（depth）。纯函数。
 */
export function flattenMenuTree(nodes: ModuleMenuNode[]): FlatMenuNode[] {
  const out: FlatMenuNode[] = [];
  const walk = (list: ModuleMenuNode[], depth: number, parentPath: string | null): void => {
    for (const node of list) {
      const myPath = node.path ?? parentPath;
      out.push({ node, depth, parentPath });
      if (node.children && node.children.length > 0) {
        walk(node.children, depth + 1, myPath);
      }
    }
  };
  walk(nodes, 0, null);
  return out;
}

async function upsertOne(
  db: AppQueryDb,
  decl: ModuleMenuNode,
  parentId: number | null,
  creatorId: number,
): Promise<number> {
  if (!decl.path) {
    // 按钮节点（type=2）没有独立 path，不建行；权限码由 bindAllPermissions 绑到祖先页面。
    return parentId ?? 0;
  }
  const existing = await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, decl.path) });
  if (existing) {
    await db
      .update(sysMenu)
      .set({
        name: decl.name,
        type: decl.type,
        parentId,
        component: decl.component ?? existing.component,
        icon: decl.icon,
        sortOrder: decl.sortOrder,
        updaterId: creatorId,
        status: 1,
        hideInMenu: toBool(decl.hideInMenu),
      })
      .where(eq(sysMenu.id, existing.id));
    return existing.id;
  }
  await db.insert(sysMenu).values({
    name: decl.name,
    path: decl.path,
    type: decl.type,
    parentId,
    component: decl.component,
    icon: decl.icon,
    sortOrder: decl.sortOrder ?? 99,
    status: 1,
    hideInMenu: toBool(decl.hideInMenu),
    isDefaultAction: toBool(decl.isDefaultAction),
    isExternalLink: false,
    keepAlive: false,
    creatorId,
    updaterId: creatorId,
  } as never);
  const created = await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, decl.path) });
  if (!created) {
    throw new Error(`菜单写入后未找到：${decl.path}`);
  }
  return created.id;
}

async function upsertTree(
  db: AppQueryDb,
  nodes: ModuleMenuNode[],
  parentId: number | null,
  creatorId: number,
): Promise<void> {
  for (const decl of nodes) {
    const id = await upsertOne(db, decl, parentId, creatorId);
    if (decl.children && decl.children.length > 0) {
      await upsertTree(db, decl.children, id, creatorId);
    }
  }
}

async function bindAllPermissions(db: AppQueryDb, flat: FlatMenuNode[]): Promise<number> {
  let bound = 0;
  for (const { node, parentPath } of flat) {
    if (!node.permissionCodes || node.permissionCodes.length === 0) continue;
    const anchorPath = node.path ?? parentPath;
    if (!anchorPath) {
      throw new Error(`菜单权限找不到可绑定的菜单行：${node.name}`);
    }
    const row = await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, anchorPath) });
    if (!row) {
      throw new Error(`菜单权限找不到菜单：${anchorPath}`);
    }
    for (const code of node.permissionCodes) {
      await db
        .insert(sysMenuPermission)
        .values({ menuId: row.id, permissionCode: code })
        .onDuplicateKeyUpdate({ set: { permissionCode: code } });
      bound++;
    }
  }
  return bound;
}

/**
 * 幂等地登记一个模块的菜单树与按钮权限绑定。creator 记为 admin 用户（不存在时为 1）。
 */
export async function seedModuleMenus(
  tree: ModuleMenuNode[],
  db: AppQueryDb = drizzleDb,
): Promise<{ menus: number; permissionBindings: number }> {
  const [admin] = await db
    .select({ id: sysUser.id })
    .from(sysUser)
    .where(eq(sysUser.username, "admin"))
    .limit(1);
  const creatorId = admin?.id ?? 1;
  await upsertTree(db, tree, null, creatorId);
  const flat = flattenMenuTree(tree);
  const permissionBindings = await bindAllPermissions(db, flat);
  return { menus: flat.filter((f) => f.node.path).length, permissionBindings };
}
