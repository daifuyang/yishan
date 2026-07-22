/**
 * seed 模块的类型 + 运行时派生配置。
 *
 * 静态 seed 数据（菜单、字典、权限码、admin 账号、岗位、部门、portal 等）
 * 拆到 config/*.json，一个功能一个 JSON 文件，便于非 TS 贡献者直接修改。
 * 这里只留下：
 *   1. 类型契约 —— MenuSeedNode / DeptSeedNode / DictSeedConfig / Portal* 等，
 *      seed 流程依赖这些类型去校验 JSON 形状。
 *   2. 运行时派生配置 —— assertSeedEnvironment 守卫、admin 密码来源（env 注入，
 *      不写进 JSON）。
 *   3. seedConfig 聚合对象 —— 把各 JSON re-export 出来，下游（seed/index.ts、
 *      seed/modules/*.ts）从 seedConfig.* 取值，不感知具体 JSON 文件。
 */
import adminJson from './config/admin.json'
import rolesJson from './config/roles.json'
import departmentsJson from './config/departments.json'
import postsJson from './config/posts.json'
import dictsJson from './config/dicts.json'
import systemMenusJson from './config/system-menus.json'
import accountMenusJson from './config/account-menus.json'
import sysOptionsJson from './config/sys-options.json'
import portalCategoriesJson from './config/portal-categories.json'
import portalPagesJson from './config/portal-pages.json'
import portalTemplatesJson from './config/portal-templates.json'
import portalArticlesJson from './config/portal-articles.json'

// ---------------------------------------------------------------------------
// 类型契约
// ---------------------------------------------------------------------------

export type DeptSeedNode = {
  name: string;
  sortOrder: number;
  description?: string;
  children?: DeptSeedNode[];
};

export type MenuSeedNode = {
  name: string;
  path?: string;
  type: number;
  sortOrder: number;
  icon?: string;
  component?: string;
  hideInMenu?: boolean;
  /**
   * 页面完整操作映射。每个权限码对应页面上的一个可见操作，并由后端接口
   * 使用同一权限码校验；不再根据权限码前缀推断页面按钮。
   */
  permissionCodes?: string[];
  /** 按钮是否为页面默认访问操作（通常为查看/列表）。 */
  isDefaultAction?: boolean;
  children?: MenuSeedNode[];
};

export type DictSeedConfig = {
  type: {
    name: string;
    type: string;
    sortOrder: number;
    remark?: string;
  };
  data: Array<{
    label: string;
    value: string;
    sortOrder: number;
    isDefault?: boolean;
    remark?: string;
  }>;
};

export type PortalCategorySeed = {
  name: string;
  slug: string;
  sortOrder: number;
  description?: string;
  parentSlug?: string;
};

export type PortalPageSeed = {
  title: string;
  path: string;
  content: string;
  attributes?: Record<string, any>;
};

export type PortalArticleSeed = {
  title: string;
  slug: string;
  content: string;
  categorySlugs: string[];
  status: number;
  isPinned: boolean;
  tags?: string[];
  attributes?: Record<string, any>;
};

export type PortalTemplateSeed = {
  name: string;
  type: 'article' | 'page';
  description?: string;
  schema?: Record<string, any>;
  config?: Record<string, any>;
};

export type SysOptionSeed = {
  key: string;
  value: string;
};

// ---------------------------------------------------------------------------
// 运行时派生配置（不能进 JSON：env 派生 / 守卫）
// ---------------------------------------------------------------------------

const isProduction = process.env.NODE_ENV === 'production';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? (isProduction ? '' : 'admin123');

export function assertSeedEnvironment() {
  if (isProduction && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('生产环境执行 seed 必须显式设置 ALLOW_PRODUCTION_SEED=true');
  }
  if (!adminPassword) {
    throw new Error('必须通过 SEED_ADMIN_PASSWORD 设置管理员初始密码');
  }
}

/** 管理员账号：静态字段来自 config/admin.json，password 从环境变量注入。 */
export const adminSeed = {
  ...adminJson,
  password: adminPassword,
};

/** 角色种子：来自 config/roles.json。 */
export const rolesSeed = rolesJson;

// ---------------------------------------------------------------------------
// 聚合 re-export：所有静态 seed 数据从此处取
// ---------------------------------------------------------------------------

export const seedConfig = {
  adminSeed,
  rolesSeed,
  deptTreeSeed: departmentsJson as DeptSeedNode,
  postsSeed: postsJson as Array<{ name: string; sortOrder: number; description: string }>,
  dictsSeed: dictsJson as DictSeedConfig[],
  systemMenusSeed: systemMenusJson as MenuSeedNode,
  accountMenusSeed: accountMenusJson as MenuSeedNode,
  sysOptionsSeed: sysOptionsJson as SysOptionSeed[],
  portalCategoriesSeed: portalCategoriesJson as PortalCategorySeed[],
  portalPagesSeed: portalPagesJson as PortalPageSeed[],
  portalTemplatesSeed: portalTemplatesJson as PortalTemplateSeed[],
  portalArticlesSeed: portalArticlesJson as PortalArticleSeed[],
} as const;

// ---------------------------------------------------------------------------
// 旧命名导出的兼容 shim：保留别名，下游 `import { x } from '../config.js'`
// 的写法无需改动。新代码建议直接 `import { seedConfig } from '...'`。
// ---------------------------------------------------------------------------

export const deptTreeSeed = seedConfig.deptTreeSeed;
export const postsSeed = seedConfig.postsSeed;
export const dictsSeed = seedConfig.dictsSeed;
export const systemMenusSeed = seedConfig.systemMenusSeed;
export const accountMenusSeed = seedConfig.accountMenusSeed;
export const sysOptionsSeed = seedConfig.sysOptionsSeed;
export const portalCategoriesSeed = seedConfig.portalCategoriesSeed;
export const portalPagesSeed = seedConfig.portalPagesSeed;
export const portalTemplatesSeed = seedConfig.portalTemplatesSeed;
export const portalArticlesSeed = seedConfig.portalArticlesSeed;