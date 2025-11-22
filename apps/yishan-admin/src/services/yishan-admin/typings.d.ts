declare namespace API {
  type cleanupTokensReq = {
    /** 定时任务令牌，用于接口鉴权 */
    cron_token: string;
    /** 保留天数，默认30天 */
    days_to_keep?: number;
  };

  type cleanupTokensResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: { deletedCount?: number; revokedCount?: number; message?: string };
  };

  type createDeptReq = {
    /** 部门名称 */
    name: string;
    /** 上级部门ID */
    parentId?: number;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 部门描述 */
    description?: string;
    /** 负责人ID */
    leaderId?: number;
  };

  type createUserReq = {
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 用户密码 */
    password: string;
    /** 手机号 */
    phone: string;
    /** 真实姓名 */
    realName?: string;
    /** 昵称 */
    nickname?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender?: "0" | "1" | "2";
    birthDate?: string | "";
    /** 状态（0-禁用，1-启用，2-锁定） */
    status?: "0" | "1" | "2";
    /** 部门ID列表 */
    deptIds?: number[];
    /** 角色ID列表 */
    roleIds?: number[];
  };

  type currentUser = {
    /** 用户ID */
    id: number;
    /** 用户名 */
    username: string;
    /** 邮箱 */
    email?: string;
    /** 手机号 */
    phone?: string;
    /** 真实姓名 */
    realName: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender: "0" | "1" | "2";
    /** 性别名称 */
    genderName: string;
    /** 出生日期 */
    birthDate?: string;
    /** 状态（0-禁用，1-启用，2-锁定） */
    status: "0" | "1" | "2";
    /** 状态名称 */
    statusName: string;
    /** 最后登录时间 */
    lastLoginTime?: string;
    /** 最后登录IP */
    lastLoginIp?: string;
    /** 登录次数 */
    loginCount: number;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
    /** 已授权菜单路径列表 */
    accessPath?: string[];
  };

  type currentUserResp = {
    code: number;
    message: string;
    success: boolean;
    data: currentUser;
    timestamp: string;
  };

  type deleteDeptParams = {
    /** 部门ID */
    id: number;
  };

  type deleteDictDataParams = {
    id: number;
  };

  type deleteDictTypeParams = {
    id: number;
  };

  type deleteMenuParams = {
    /** 菜单ID */
    id: string;
  };

  type deletePostParams = {
    /** 岗位ID */
    id: string;
  };

  type deleteRoleParams = {
    /** 角色ID */
    id: number;
  };

  type deleteUserParams = {
    /** 用户ID */
    id: number;
  };

  type deptDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type deptDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDept;
    timestamp: string;
  };

  type deptListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 部门状态 */
    status?: "0" | "1";
    /** 上级部门ID过滤 */
    parentId?: number;
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type deptListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDept[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type deptTreeList = deptTreeNode[];

  type deptTreeNode = {
    /** 部门ID */
    id: number;
    /** 部门名称 */
    name: string;
    /** 上级部门ID */
    parentId?: number;
    /** 上级部门名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 部门描述 */
    description?: string;
    /** 负责人ID */
    leaderId?: number;
    /** 负责人名称 */
    leaderName?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    children: deptTreeNode[] | null;
  };

  type deptTreeResp = {
    code: number;
    message: string;
    success: boolean;
    data: deptTreeList;
    timestamp: string;
  };

  type dictDataDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type dictDataDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDictData;
    timestamp: string;
  };

  type dictDataListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    typeId?: number;
    type?: string;
    keyword?: string;
    status?: 0 | 1;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type dictDataListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDictData[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type dictDataMapResp = {
    code: number;
    message: string;
    success: boolean;
    data: Record<string, any>;
    timestamp: string;
  };

  type dictTypeDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type dictTypeDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDictType;
    timestamp: string;
  };

  type dictTypeListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    keyword?: string;
    status?: 0 | 1;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type dictTypeListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDictType[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type getDeptDetailParams = {
    /** 部门ID */
    id: number;
  };

  type getDeptListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 部门状态 */
    status?: "0" | "1";
    /** 上级部门ID过滤 */
    parentId?: number;
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getDictDataDetailParams = {
    id: number;
  };

  type getDictDataListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    typeId?: number;
    type?: string;
    keyword?: string;
    status?: 0 | 1;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getDictTypeDetailParams = {
    id: number;
  };

  type getDictTypeListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    keyword?: string;
    status?: 0 | 1;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getMenuDetailParams = {
    /** 菜单ID */
    id: string;
  };

  type getMenuListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、路径、组件、权限） */
    keyword?: string;
    /** 菜单状态 */
    status?: "0" | "1";
    /** 菜单类型 */
    type?: 0 | 1 | 2;
    /** 父级菜单ID过滤 */
    parentId?: number;
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getPostDetailParams = {
    /** 岗位ID */
    id: string;
  };

  type getPostListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 岗位状态 */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getRoleDetailParams = {
    /** 角色ID */
    id: number;
  };

  type getRoleListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（角色名称、描述） */
    keyword?: string;
    /** 角色状态（0-禁用，1-启用） */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getUserDetailParams = {
    /** 用户ID */
    id: number;
  };

  type getUserListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（用户名、邮箱、真实姓名、昵称） */
    keyword?: string;
    /** 用户状态（0-禁用，1-启用，2-锁定） */
    status?: "0" | "1" | "2";
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "lastLoginTime" | "loginCount";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type loginData = {
    /** 访问令牌 */
    token: string;
    /** 刷新令牌 */
    refreshToken?: string;
    /** 访问令牌过期时间（秒） */
    expiresIn: number;
    /** 刷新令牌过期时间（秒） */
    refreshTokenExpiresIn?: number;
    /** 访问令牌过期时间戳（秒） */
    expiresAt?: number;
    /** 刷新令牌过期时间戳（秒） */
    refreshTokenExpiresAt?: number;
  };

  type loginReq = {
    /** 用户名或邮箱 */
    username: string;
    /** 密码 */
    password: string;
    /** 记住我 */
    rememberMe?: boolean;
  };

  type loginResp = {
    code: number;
    message: string;
    success: boolean;
    data: loginData;
    timestamp: string;
  };

  type menuDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type menuDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysMenu;
    timestamp: string;
  };

  type menuListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、路径、组件、权限） */
    keyword?: string;
    /** 菜单状态 */
    status?: "0" | "1";
    /** 菜单类型 */
    type?: 0 | 1 | 2;
    /** 父级菜单ID过滤 */
    parentId?: number;
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type menuListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysMenu[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type menuPaths = Record<string, any>;

  type menuPathsResp = {
    code: number;
    message: string;
    success: boolean;
    data: string[];
    timestamp: string;
  };

  type menuTreeList = menuTreeNode[];

  type menuTreeNode = {
    /** 菜单ID */
    id: number;
    /** 菜单名称 */
    name: string;
    /** 类型（0:目录,1:菜单,2:按钮） */
    type: 0 | 1 | 2;
    /** 路由路径/URL */
    path?: string;
    /** 图标名 */
    icon?: string;
    /** 前端组件路径 */
    component?: string;
    /** 父级菜单ID */
    parentId?: number;
    /** 父级菜单名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 是否在菜单中隐藏 */
    hideInMenu: boolean;
    /** 是否外链 */
    isExternalLink: boolean;
    /** 权限标识 */
    perm?: string;
    /** 是否缓存页面 */
    keepAlive: boolean;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    children: menuTreeNode[] | null;
  };

  type menuTreeResp = {
    code: number;
    message: string;
    success: boolean;
    data: menuTreeList;
    timestamp: string;
  };

  type paginationResponse = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  type postDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type postDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysPost;
    timestamp: string;
  };

  type postListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 岗位状态 */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type postListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysPost[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type refreshTokenReq = {
    /** 刷新令牌 */
    refreshToken: string;
  };

  type refreshTokenResp = {
    code: number;
    message: string;
    success: boolean;
    data: loginData;
    timestamp: string;
  };

  type roleDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type roleDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysRole;
    timestamp: string;
  };

  type roleListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（角色名称、描述） */
    keyword?: string;
    /** 角色状态（0-禁用，1-启用） */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type roleListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysRole[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type saveDictDataReq = {
    typeId: number;
    label: string;
    value: string;
    status?: 0 | 1;
    sort_order?: number;
    tag?: string;
    remark?: string;
    isDefault?: boolean;
  };

  type saveDictTypeReq = {
    name: string;
    type: string;
    status?: 0 | 1;
    sort_order?: number;
    remark?: string;
  };

  type saveMenuReq = {
    /** 菜单名称 */
    name: string;
    /** 菜单类型 */
    type?: 0 | 1 | 2;
    /** 父级菜单ID */
    parentId?: number;
    /** 路由路径/URL */
    path?: string;
    /** 图标名 */
    icon?: string;
    /** 组件路径 */
    component?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 隐藏菜单 */
    hideInMenu?: boolean;
    /** 是否外链 */
    isExternalLink?: boolean;
    /** 权限标识 */
    perm?: string;
    /** 是否缓存 */
    keepAlive?: boolean;
  };

  type savePostReq = {
    /** 岗位名称 */
    name: string;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 岗位描述 */
    description?: string;
  };

  type saveRoleReq = {
    /** 角色名称 */
    name: string;
    /** 角色描述 */
    description?: string;
    /** 状态（0-禁用，1-启用） */
    status?: "0" | "1";
    /** 菜单ID列表 */
    menuIds?: number[];
  };

  type sysDept = {
    /** 部门ID */
    id: number;
    /** 部门名称 */
    name: string;
    /** 上级部门ID */
    parentId?: number;
    /** 上级部门名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 部门描述 */
    description?: string;
    /** 负责人ID */
    leaderId?: number;
    /** 负责人名称 */
    leaderName?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type sysDictData = {
    id: number;
    typeId: number;
    type: string;
    label: string;
    value: string;
    status: 0 | 1;
    sort_order: number;
    tag?: string;
    remark?: string;
    isDefault: boolean;
    creatorId?: number;
    creatorName?: string;
    createdAt: string;
    updaterId?: number;
    updaterName?: string;
    updatedAt: string;
  };

  type sysDictType = {
    id: number;
    name: string;
    type: string;
    status: 0 | 1;
    sort_order: number;
    remark?: string;
    creatorId?: number;
    creatorName?: string;
    createdAt: string;
    updaterId?: number;
    updaterName?: string;
    updatedAt: string;
  };

  type sysMenu = {
    /** 菜单ID */
    id: number;
    /** 菜单名称 */
    name: string;
    /** 类型（0:目录,1:菜单,2:按钮） */
    type: 0 | 1 | 2;
    /** 路由路径/URL */
    path?: string;
    /** 图标名 */
    icon?: string;
    /** 前端组件路径 */
    component?: string;
    /** 父级菜单ID */
    parentId?: number;
    /** 父级菜单名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 是否在菜单中隐藏 */
    hideInMenu: boolean;
    /** 是否外链 */
    isExternalLink: boolean;
    /** 权限标识 */
    perm?: string;
    /** 是否缓存页面 */
    keepAlive: boolean;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type sysPost = {
    /** 岗位ID */
    id: number;
    /** 岗位名称 */
    name: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 岗位描述 */
    description?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type sysRole = {
    /** 角色ID */
    id: number;
    /** 角色名称 */
    name: string;
    /** 角色描述 */
    description?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 是否系统默认角色 */
    isSystemDefault?: boolean;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    /** 菜单ID列表 */
    menuIds?: number[];
  };

  type sysUser = {
    /** 用户ID */
    id: number;
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 手机号 */
    phone: string;
    /** 真实姓名 */
    realName?: string;
    /** 昵称 */
    nickname?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender: "0" | "1" | "2";
    /** 性别名称 */
    genderName: string;
    /** 出生日期 */
    birthDate?: string;
    /** 状态（0-禁用，1-启用，2-锁定） */
    status: "0" | "1" | "2";
    /** 状态名称 */
    statusName: string;
    /** 最后登录时间 */
    lastLoginTime?: string;
    /** 最后登录IP */
    lastLoginIp?: string;
    /** 登录次数 */
    loginCount: number;
    /** 创建人Id */
    creatorId: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    /** 部门ID列表 */
    deptIds?: number[];
    /** 角色ID列表 */
    roleIds?: number[];
  };

  type tokenStatsResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: {
      totalTokens?: number;
      activeTokens?: number;
      expiredTokens?: number;
      revokedTokens?: number;
    };
  };

  type updateDeptParams = {
    /** 部门ID */
    id: number;
  };

  type updateDeptReq = {
    /** 部门名称 */
    name?: string;
    /** 上级部门ID */
    parentId?: number;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 部门描述 */
    description?: string;
    /** 负责人ID */
    leaderId?: number;
  };

  type updateDictDataParams = {
    id: number;
  };

  type updateDictDataReq = {
    typeId?: number;
    label?: string;
    value?: string;
    status?: 0 | 1;
    sort_order?: number;
    tag?: string;
    remark?: string;
    isDefault?: boolean;
  };

  type updateDictTypeParams = {
    id: number;
  };

  type updateDictTypeReq = {
    name?: string;
    type?: string;
    status?: 0 | 1;
    sort_order?: number;
    remark?: string;
  };

  type updateMenuParams = {
    /** 菜单ID */
    id: string;
  };

  type updateMenuReq = {
    /** 菜单名称 */
    name?: string;
    /** 菜单类型 */
    type?: 0 | 1 | 2;
    /** 父级菜单ID */
    parentId?: number;
    /** 路由路径/URL */
    path?: string;
    /** 图标名 */
    icon?: string;
    /** 组件路径 */
    component?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 隐藏菜单 */
    hideInMenu?: boolean;
    /** 是否外链 */
    isExternalLink?: boolean;
    /** 权限标识 */
    perm?: string;
    /** 是否缓存 */
    keepAlive?: boolean;
  };

  type updatePostParams = {
    /** 岗位ID */
    id: string;
  };

  type updatePostReq = {
    /** 岗位名称 */
    name?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 岗位描述 */
    description?: string;
  };

  type updateRoleParams = {
    /** 角色ID */
    id: number;
  };

  type updateRoleReq = {
    /** 角色名称 */
    name?: string;
    /** 角色描述 */
    description?: string;
    /** 状态（0-禁用，1-启用） */
    status?: "0" | "1";
    /** 菜单ID列表 */
    menuIds?: number[];
  };

  type updateUserParams = {
    /** 用户ID */
    id: number;
  };

  type updateUserReq = {
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 用户密码 */
    password?: string;
    /** 手机号 */
    phone?: string;
    /** 真实姓名 */
    realName?: string;
    /** 昵称 */
    nickname?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender?: "0" | "1" | "2";
    birthDate?: string | "";
    /** 状态（0-禁用，1-启用，2-锁定） */
    status?: "0" | "1" | "2";
    /** 部门ID列表 */
    deptIds?: number[];
    /** 角色ID列表 */
    roleIds?: number[];
  };

  type userDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number; deleted: boolean };
    timestamp: string;
  };

  type userDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysUser;
    timestamp: string;
  };

  type userListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（用户名、邮箱、真实姓名、昵称） */
    keyword?: string;
    /** 用户状态（0-禁用，1-启用，2-锁定） */
    status?: "0" | "1" | "2";
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "lastLoginTime" | "loginCount";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type userListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysUser[];
    timestamp: string;
    pagination: paginationResponse;
  };
}
