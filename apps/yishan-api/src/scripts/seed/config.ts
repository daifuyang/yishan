export type DeptSeedNode = {
  name: string;
  sortOrder: number;
  description?: string;
  children?: DeptSeedNode[];
};

export type MenuSeedNode = {
  name: string;
  path: string;
  type: number;
  sortOrder: number;
  icon?: string;
  component?: string;
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

export const adminSeed = {
  username: 'admin',
  password: 'admin123',
  email: 'admin@yishan.com',
  phone: '13800138000',
  realName: '愚公',
  nickname: '超级管理员',
  avatar: '',
  gender: 1,
};

export const rolesSeed = {
  superAdmin: { name: '超级管理员', description: '拥有系统最高权限' },
  admin: { name: '普通管理员', description: '拥有基础管理权限' },
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

export const systemMenusSeed: MenuSeedNode = {
  name: '系统管理',
  path: '/system',
  type: 0,
  sortOrder: 1,
  icon: 'setting',
  children: [
    { name: '用户管理', path: '/system/user', type: 1, sortOrder: 1, component: './system/user' },
    { name: '角色管理', path: '/system/role', type: 1, sortOrder: 2, component: './system/role' },
    { name: '部门管理', path: '/system/department', type: 1, sortOrder: 3, component: './system/department' },
    { name: '岗位管理', path: '/system/post', type: 1, sortOrder: 4, component: './system/post' },
    { name: '菜单管理', path: '/system/menu', type: 1, sortOrder: 5, component: './system/menu' },
    { name: '字典管理', path: '/system/dict', type: 1, sortOrder: 6, component: './system/dict' },
    { name: '站点配置', path: '/system/site', type: 1, sortOrder: 7, component: './system/site' },
    { name: '云存储', path: '/system/storage', type: 1, sortOrder: 8, component: './system/storage' },
    { name: '媒体库', path: '/system/attachments', type: 1, sortOrder: 9, component: './system/attachments' },
    { name: '登录日志', path: '/system/login-log', type: 1, sortOrder: 10, component: './system/login-log' },
  ],
};

export const portalMenusSeed: MenuSeedNode = {
  name: '门户管理',
  path: '/portal',
  type: 0,
  sortOrder: 2,
  icon: 'read',
  children: [
    { name: '文章管理', path: '/portal/articles', type: 1, sortOrder: 1, component: './portal/articles' },
    { name: '页面管理', path: '/portal/pages', type: 1, sortOrder: 2, component: './portal/pages' },
    { name: '分类管理', path: '/portal/categories', type: 1, sortOrder: 3, component: './portal/categories' },
    {
      name: '模板设置',
      path: '/portal/templates',
      type: 0,
      sortOrder: 4,
      children: [
        { name: '文章模板', path: '/portal/article-templates', type: 1, sortOrder: 1, component: './portal/article-templates' },
        { name: '页面模板', path: '/portal/page-templates', type: 1, sortOrder: 2, component: './portal/page-templates' },
      ],
    },
  ],
};

export const sysOptionsSeed: SysOptionSeed[] = [
  { key: 'basicConfig', value: '{}' }, // 站点基本配置
  { key: 'systemStorage', value: '0' },
  { key: 'qiniuConfig', value: '{}' },
  { key: 'aliyunOssConfig', value: '{}' },
  { key: 'defaultArticleTemplateId', value: '1' },
  { key: 'defaultPageTemplateId', value: '2' },
]
