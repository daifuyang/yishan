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
  source?: 'custom' | 'plugin';
  pluginName?: string;
  pluginMenuKey?: string;
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

export const adminSeed = {
  username: 'admin',
  password: adminPassword,
  email: 'admin@yishan.com',
  phone: '13800138000',
  realName: '愚公',
  nickname: '超级管理员',
  avatar: '',
  gender: 1,
};

export const rolesSeed = {
  superAdmin: { name: '超级管理员', code: 'super_admin', description: '拥有系统最高权限' },
  admin: { name: '普通管理员', code: 'admin', description: '拥有基础管理权限' },
  hospitalAccount: { name: '医院账号', code: 'hospital_account', description: '仅可访问所属医院的派单处理能力' },
};

export const deptTreeSeed: DeptSeedNode = {
  name: '愚公软件',
  sortOrder: 0,
  description: '公司根节点',
  children: [
    {
      name: '上海总公司',
      sortOrder: 1,
      description: '总部',
      children: [
        { name: '研发部门（上海）', sortOrder: 1, description: '研发部门' },
        { name: '市场部门（上海）', sortOrder: 2, description: '市场部门' },
        { name: '测试部门（上海）', sortOrder: 3, description: '测试部门' },
        { name: '财务部门（上海）', sortOrder: 4, description: '财务部门' },
        { name: '运维部门（上海）', sortOrder: 5, description: '运维部门' },
      ],
    },
    {
      name: '常州分公司',
      sortOrder: 2,
      description: '分公司',
      children: [
        { name: '市场部门（常州）', sortOrder: 1, description: '市场部门' },
        { name: '财务部门（常州）', sortOrder: 2, description: '财务部门' },
      ],
    },
  ],
};

export const postsSeed = [
  { name: '董事长', sortOrder: 1, description: '公司最高负责人' },
  { name: '项目经理', sortOrder: 2, description: '项目管理与协调' },
  { name: '人力资源', sortOrder: 3, description: '人事管理' },
  { name: '普通员工', sortOrder: 4, description: '基础岗位' },
];

export const dictsSeed: DictSeedConfig[] = [
  {
    type: { name: '用户性别', type: 'user_gender', sortOrder: 1, remark: '用户性别字典' },
    data: [
      { label: '保密', value: '0', sortOrder: 0 },
      { label: '男', value: '1', sortOrder: 1 },
      { label: '女', value: '2', sortOrder: 2 },
    ],
  },
  {
    type: { name: '用户状态', type: 'user_status', sortOrder: 2, remark: '用户状态字典' },
    data: [
      { label: '禁用', value: '0', sortOrder: 0 },
      { label: '启用', value: '1', sortOrder: 1, isDefault: true },
      { label: '拉黑', value: '2', sortOrder: 2 },
    ],
  },
  {
    type: { name: '默认状态', type: 'default_status', sortOrder: 3, remark: '通用启用/禁用状态字典' },
    data: [
      { label: '禁用', value: '0', sortOrder: 0 },
      { label: '启用', value: '1', sortOrder: 1, isDefault: true },
    ],
  },
];

export const portalCategoriesSeed: PortalCategorySeed[] = [
  { name: '新闻', slug: 'news', sortOrder: 1, description: '公司新闻' },
  { name: '公告', slug: 'notice', sortOrder: 2, description: '系统公告' },
  { name: '技术博客', slug: 'blog', sortOrder: 3, description: '技术分享' },
];

export const portalPagesSeed: PortalPageSeed[] = [
  { title: '首页', path: '/home', content: '欢迎访问门户网站', attributes: { banner: '/assets/banner.jpg' } },
  { title: '关于我们', path: '/about', content: '关于我们页面内容', attributes: { layout: 'full' } },
  { title: '联系我们', path: '/contact', content: '联系方式与地址', attributes: { form: true } },
];

export const portalTemplatesSeed: PortalTemplateSeed[] = [
  { name: '默认详情', type: 'article', description: '系统默认文章详情模板' },
  { name: '默认页面', type: 'page', description: '系统默认页面模板' },
];

export const portalArticlesSeed: PortalArticleSeed[] = [
  {
    title: '欢迎使用门户',
    slug: 'welcome',
    content: '这是门户的欢迎文章',
    categorySlugs: ['news'],
    status: 1,
    isPinned: true,
    tags: ['置顶', '公告'],
    attributes: { readingTime: 3 },
  },
  {
    title: '系统发布 1.0',
    slug: 'release-1-0',
    content: '系统 1.0 版本发布说明',
    categorySlugs: ['notice'],
    status: 1,
    isPinned: false,
    tags: ['发布'],
    attributes: { version: '1.0.0' },
  },
  {
    title: '使用指南',
    slug: 'how-to-use',
    content: '系统使用指南与最佳实践',
    categorySlugs: ['blog'],
    status: 1,
    isPinned: false,
    tags: ['指南'],
    attributes: { level: 'beginner' },
  },
];

const action = (name: string, permissionCode: string, sortOrder: number, isDefaultAction = false): MenuSeedNode => ({
  name,
  type: 2,
  sortOrder,
  hideInMenu: true,
  permissionCodes: [permissionCode],
  isDefaultAction,
});

const page = (args: Omit<MenuSeedNode, 'type' | 'children' | 'permissionCodes'> & { actions: MenuSeedNode[] }): MenuSeedNode => ({
  ...args,
  type: 1,
  children: args.actions,
});

const crmPage = (args: Omit<MenuSeedNode, 'type' | 'children' | 'permissionCodes' | 'source' | 'pluginName' | 'pluginMenuKey'> & { actions: MenuSeedNode[] }): MenuSeedNode =>
  page({
    ...args,
    source: 'plugin',
    pluginName: 'crm',
    pluginMenuKey: `iximei/crm:${args.path}`,
  });

export const systemMenusSeed: MenuSeedNode = {
  name: '系统管理',
  path: '/system',
  type: 0,
  // 系统管理固定置顶；其余一级菜单保持各自现有排序。
  sortOrder: 0,
  icon: 'setting',
  children: [
    page({ name: '仪表盘', path: '/', sortOrder: 0, component: './index', hideInMenu: true, actions: [action('查看', 'system:dashboard:read', 1, true)] }),
    page({ name: '用户管理', path: '/system/user', sortOrder: 1, component: './system/user', actions: [action('查看', 'system:user:list', 1, true), action('新增', 'system:user:create', 2), action('编辑', 'system:user:update', 3), action('删除', 'system:user:delete', 4)] }),
    page({ name: '角色管理', path: '/system/role', sortOrder: 2, component: './system/role', actions: [action('查看', 'system:role:list', 1, true), action('新增', 'system:role:create', 2), action('编辑', 'system:role:update', 3), action('删除', 'system:role:delete', 4), action('授权', 'system:role:grant', 5)] }),
    page({ name: '部门管理', path: '/system/department', sortOrder: 3, component: './system/department', actions: [action('查看', 'system:department:list', 1, true), action('新增', 'system:department:create', 2), action('编辑', 'system:department:update', 3), action('删除', 'system:department:delete', 4)] }),
    page({ name: '岗位管理', path: '/system/position', sortOrder: 4, component: './system/position', actions: [action('查看', 'system:position:list', 1, true), action('新增', 'system:position:create', 2), action('编辑', 'system:position:update', 3), action('删除', 'system:position:delete', 4)] }),
    page({ name: '菜单管理', path: '/system/menu', sortOrder: 5, component: './system/menu', actions: [action('查看', 'system:menu:list', 1, true), action('新增', 'system:menu:create', 2), action('编辑', 'system:menu:update', 3), action('删除', 'system:menu:delete', 4)] }),
    page({ name: '字典管理', path: '/system/dict', sortOrder: 6, component: './system/dict', actions: [action('查看', 'system:dict:list', 1, true), action('新增', 'system:dict:create', 2), action('编辑', 'system:dict:update', 3), action('删除', 'system:dict:delete', 4)] }),
    page({ name: '站点配置', path: '/system/site', sortOrder: 7, component: './system/site', actions: [action('查看', 'system:option:list', 1, true), action('编辑', 'system:option:update', 2)] }),
    page({ name: '云存储', path: '/system/storage', sortOrder: 8, component: './system/storage', actions: [action('查看', 'system:storage:list', 1, true), action('编辑', 'system:storage:update', 2), action('上传凭证', 'system:storage:upload-token', 3)] }),
    page({ name: '媒体库', path: '/system/attachments', sortOrder: 9, component: './system/attachments', actions: [action('查看', 'system:attachment:list', 1, true), action('上传', 'system:attachment:create', 2), action('编辑', 'system:attachment:update', 3), action('删除', 'system:attachment:delete', 4)] }),
    page({ name: '登录日志', path: '/system/login-log', sortOrder: 10, component: './system/login-log', actions: [action('查看', 'system:login-log:list', 1, true)] }),
    page({ name: '插件管理', path: '/system/plugins', sortOrder: 13, component: './system/plugins', actions: [action('查看', 'system:plugin:list', 1, true), action('安装', 'system:plugin:install', 2), action('启用', 'system:plugin:enable', 3), action('禁用', 'system:plugin:disable', 4), action('同步', 'system:plugin:sync', 5), action('审计', 'system:plugin:audit', 6)] }),
  ],
};

export const accountMenusSeed: MenuSeedNode = {
  name: '我的账户',
  path: '/account',
  type: 0,
  sortOrder: 1,
  icon: 'user',
  hideInMenu: true,
  children: [
    page({ name: 'API Token', path: '/account/api-tokens', sortOrder: 1, icon: 'key', component: './account/api-tokens', hideInMenu: true, actions: [action('管理', 'system:api-token:manage', 1, true), action('列表', 'system:token:list', 2), action('清理', 'system:token:cleanup', 3)] }),
    { name: '个人中心', path: '/account/center', type: 1, sortOrder: 2, icon: 'user', component: './account/center', hideInMenu: true },
  ],
};

/** CRM 插件的管理端页面与按钮树。插件菜单同步与初始化 seed 共享此结构。 */
export const crmMenusSeed: MenuSeedNode[] = [
  crmPage({ name: '医院管理', path: '/plugins/iximei/crm/hospitals', sortOrder: 2, icon: 'hospital', actions: [action('查看', 'crm:hospital:list', 1, true), action('新增', 'crm:hospital:create', 2), action('编辑', 'crm:hospital:update', 3), action('删除', 'crm:hospital:delete', 4)] }),
  crmPage({ name: '客户管理', path: '/plugins/iximei/crm/customers', sortOrder: 3, icon: 'users-round', actions: [action('查看', 'crm:customer:list', 1, true), action('新增', 'crm:customer:create', 2), action('编辑', 'crm:customer:update', 3), action('派单', 'crm:customer:dispatch', 4)] }),
  crmPage({ name: '会员顾客', path: '/plugins/iximei/crm/members', sortOrder: 4, icon: 'contact-round', actions: [action('查看', 'crm:member:list', 1, true), action('新增', 'crm:member:create', 2), action('编辑', 'crm:member:update', 3), action('备注', 'crm:member:remark', 4)] }),
  crmPage({ name: '派单管理', path: '/plugins/iximei/crm/dispatches', sortOrder: 5, icon: 'clipboard-list', actions: [action('查看', 'crm:dispatch:list', 1, true), action('编辑', 'crm:dispatch:update', 2), action('回复', 'crm:dispatch:reply', 3), action('跟进', 'crm:dispatch:log', 4)] }),
];

export const sysOptionsSeed: SysOptionSeed[] = [
  { key: 'basicConfig', value: '{}' }, // 站点基本配置
  { key: 'systemStorage', value: '0' },
  { key: 'qiniuConfig', value: '{}' },
  { key: 'aliyunOssConfig', value: '{}' },
  { key: 'defaultArticleTemplateId', value: '1' },
  { key: 'defaultPageTemplateId', value: '2' },
]
