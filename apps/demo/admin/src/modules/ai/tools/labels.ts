/**
 * 工具展示的**唯一文案表**。
 *
 * 旧架构里同一张表散落在四五处（`adapters/toolProgress.ts`、`components/AiToolResultCard.tsx`
 * 的五张常量表、`tools/safe-data.ts`、`tools/renderers/QueryRenderer.tsx`），彼此已经漂移
 * ——比如导航白名单旧卡片只有 5 条、新卡片有 6 条。展示层只有一份文案来源，才能保证
 * 「同一个工具在不同页面显示同一句话」。
 *
 * 这里只放**面向用户的中文文案**。工具的 description 是给模型理解能力用的，默认不展示。
 */

/** 已知工具名 → 面向用户的动作名。未知工具走 `formatToolName` 的通用格式。 */
export const TOOL_TITLES: Record<string, string> = {
  discover_operations: '检索业务操作',
  describe_operation: '读取操作定义',
  query_business_data: '查询业务数据',
  update_form_draft: '更新表单草稿',
  list_users: '查询用户',
  get_user: '读取用户详情',
  list_roles: '查询角色',
  get_role: '读取角色详情',
  list_departments: '查询部门',
  get_department: '读取部门详情',
  get_user_create_form: '读取用户表单',
  get_user_create_options: '读取表单选项',
  prepare_user_create: '准备新增用户表单',
  prepare_update_user: '准备编辑用户表单',
  prepare_delete_user: '准备删除用户确认',
  prepare_create_department: '准备新增部门表单',
  prepare_create_user: '保存用户草稿',
  get_action_draft: '读取草稿',
  update_action_draft: '保存草稿',
};

/**
 * 参数摘要里允许直接展示的字段白名单。
 *
 * 只有白名单里的标量字段会进标题区：模型可以自由填写任何参数，未知字段一律不进摘要
 * （它们仍然可以在展开后的「调用详情」里看到，且已经过脱敏）。
 */
export const PARAM_LABELS: Record<string, string> = {
  keyword: '关键词',
  query: '查询词',
  username: '登录名称',
  realName: '真实姓名',
  nickname: '昵称',
  phone: '手机号码',
  email: '邮箱',
  gender: '性别',
  status: '状态',
  deptId: '归属部门',
  deptIds: '归属部门',
  roleIds: '角色',
  name: '名称',
  parentId: '上级部门',
  sortOrder: '显示排序',
  leaderId: '负责人',
  description: '说明',
  page: '页码',
  pageSize: '每页',
  path: '路径',
  url: '地址',
  id: 'ID',
};

/**
 * 结果表格里**推导出来的**列名 → 中文。
 *
 * 服务端没声明列时，前端从数据行里推列；推出来的 key 是原始字段名，直接显示对用户
 * 没有意义。这张表把「字段名 → 中文」这件**数据**的事集中在一处，而不是为每个
 * 业务对象各写一份列配置（旧架构里的 `userColumns` / `roleColumns` / …）。
 */
export const COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  username: '登录名称',
  realName: '真实姓名',
  nickname: '昵称',
  phone: '手机号码',
  email: '邮箱',
  gender: '性别',
  status: '状态',
  deptId: '归属部门',
  deptIds: '归属部门',
  deptName: '归属部门',
  roleIds: '角色',
  name: '名称',
  parentId: '上级部门',
  sortOrder: '显示排序',
  leaderId: '负责人',
  description: '说明',
  createdAt: '创建时间',
  updatedAt: '更新时间',
};

/** 结果表格里的枚举值 → 中文。`format` 由后端声明，前端只做展示映射。 */
export const ENUM_LABELS: Record<string, Record<string, string>> = {
  status: { '0': '禁用', '1': '启用', '2': '锁定' },
  gender: { '0': '未知', '1': '男', '2': '女' },
  scope: {
    '1': '全部数据',
    '2': '本部门',
    '3': '本部门及子部门',
    '4': '仅本人',
    '5': '自定义部门',
  },
};

/**
 * 可跳转页面的本地白名单。
 *
 * 模型给出的目标**永远**要过这张表：即便服务端回传了 `path`，前端也只认本地路由，
 * 模型无法把用户带到任意地址。
 */
export const NAVIGATE_TARGETS: Record<string, { route: string; label: string }> = {
  user_list: { route: '/system/user', label: '用户管理' },
  role_list: { route: '/system/role', label: '角色管理' },
  department_list: { route: '/system/department', label: '部门管理' },
  position_list: { route: '/system/position', label: '岗位管理' },
  menu_list: { route: '/system/menu', label: '菜单管理' },
  dict_list: { route: '/system/dict', label: '字典管理' },
};

/**
 * 未知工具名的通用展示格式：`external_lookup` → `External Lookup`。
 *
 * 只在没有可信中文标题时使用；不做任何语义猜测。
 */
export function formatToolName(name: string): string {
  const words = name.replace(/[_-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '工具调用';
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
