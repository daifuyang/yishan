declare namespace API {
  type baseResponse = {
    code?: number;
    message?: string;
    /** 请求是否成功 */
    success?: boolean;
  };

  type conflictResponse = {
    code?: number;
    message?: string;
    /** 请求是否成功 */
    success?: boolean;
    /** 错误响应数据为空 */
    data?: null;
    timestamp?: string;
    error?: { type?: string; detail?: string; errorId?: string };
  };

  type deleteAdminDepartmentsIdParams = {
    /** 部门ID */
    id: number;
  };

  type deleteRoleParams = {
    /** 角色ID */
    id: number;
  };

  type deleteUserParams = {
    /** 用户ID */
    id: number;
  };

  type errorResponse = {
    code?: number;
    message?: string;
    /** 请求是否成功 */
    success?: boolean;
    /** 错误响应数据为空 */
    data?: null;
    timestamp?: string;
    error?: {
      type?: string;
      detail?: string;
      errorId?: string;
      validation?: Record<string, any>;
    };
  };

  type forbiddenResponse = {
    code?: number;
    message?: string;
    /** 请求是否成功 */
    success?: boolean;
    /** 错误响应数据为空 */
    data?: null;
    timestamp?: string;
    error?: { type?: string; detail?: string; errorId?: string };
  };

  type getAdminDepartmentsIdParams = {
    /** 部门ID */
    id: number;
  };

  type getDepartmentListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 部门名称（模糊查询） */
    deptName?: string;
    /** 父部门ID */
    parentId?: any;
    /** 部门类型 */
    deptType?: 1 | 2 | 3;
    /** 状态 */
    status?: 0 | 1;
    /** 部门负责人ID */
    leaderId?: number;
  };

  type getRoleByIdParams = {
    /** 角色ID */
    id: number;
  };

  type getRoleListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（支持角色名称模糊搜索） */
    search?: string;
    /** 角色名称筛选 */
    roleName?: string;
    /** 状态筛选：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 是否系统角色筛选：0-否，1-是 */
    isSystem?: 0 | 1;
    /** 排序字段 */
    sortBy?:
      | "id"
      | "roleName"
      | "status"
      | "isSystem"
      | "sortOrder"
      | "createdAt"
      | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
    /** 多字段排序配置，优先级从高到低。与sortBy/sortOrder互斥，优先使用sorts */
    sorts?:
      | string
      | {
          field:
            | "id"
            | "roleName"
            | "status"
            | "isSystem"
            | "sortOrder"
            | "createdAt"
            | "updatedAt";
          order: "asc" | "desc";
        }[];
  };

  type getRolePermissionsParams = {
    /** 角色ID */
    id: number;
  };

  type getRoleUsersParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（支持用户名、真实姓名模糊搜索） */
    search?: string;
    /** 用户名筛选 */
    username?: string;
    /** 真实姓名筛选 */
    realName?: string;
    /** 状态筛选：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
    /** 角色ID */
    id: number;
  };

  type getUserByIdParams = {
    /** 用户ID */
    id: number;
  };

  type getUserByUsernameParams = {
    /** 用户名 */
    username: string;
  };

  type getUserListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（支持用户名、邮箱、真实姓名、手机号模糊搜索） */
    search?: string;
    /** 用户名筛选 */
    username?: string;
    /** 邮箱筛选 */
    email?: string;
    /** 真实姓名筛选 */
    realName?: string;
    /** 手机号筛选 */
    phone?: string;
    /** 状态筛选：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
    /** 排序字段 */
    sortBy?:
      | "id"
      | "username"
      | "email"
      | "realName"
      | "createdAt"
      | "updatedAt"
      | "lastLoginTime"
      | "status";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getUserRolesParams = {
    /** 用户ID */
    userId: number;
  };

  type idParam = {
    /** ID */
    id: number;
  };

  type notFoundResponse = {
    code?: number;
    message?: string;
    /** 请求是否成功 */
    success?: boolean;
    /** 错误响应数据为空 */
    data?: null;
    timestamp?: string;
    error?: { type?: string; detail?: string; errorId?: string };
  };

  type PaginatedResponse =
    // #/components/schemas/StandardResponse
    StandardResponse & {
      data: { list: Record<string, any>[]; pagination: PaginationResponse };
    };

  type PaginationResponse = {
    /** 当前页码 */
    page: number;
    /** 每页条数 */
    pageSize: number;
    /** 总记录数 */
    total: number;
    /** 总页数 */
    totalPages: number;
  };

  type putAdminDepartmentsIdParams = {
    /** 部门ID */
    id: number;
  };

  type putAdminDepartmentsIdStatusParams = {
    /** 部门ID */
    id: number;
  };

  type resetUserPasswordParams = {
    /** 用户ID */
    id: number;
  };

  type StandardResponse = {
    /** 业务状态码（5位数字：20000-29999成功，40000-49999客户端错误，50000-59999服务器错误） */
    code: number;
    /** 响应消息 */
    message: string;
  };

  type successResponse = {
    code?: number;
    message?: string;
    /** 请求是否成功 */
    success?: boolean;
    /** 响应数据 */
    data?: any;
  };

  type sysDepartment = {
    /** 部门ID */
    id?: number;
    /** 父部门ID，0表示顶级部门 */
    parentId?: any;
    /** 部门名称 */
    deptName?: string;
    /** 部门描述 */
    deptDesc?: string;
    /** 部门类型：1-公司，2-部门，3-小组 */
    deptType?: 1 | 2 | 3;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
    /** 部门负责人ID */
    leaderId?: number;
    /** 部门负责人姓名 */
    leaderName?: string;
    /** 部门电话 */
    phone?: string;
    /** 部门邮箱 */
    email?: string;
    /** 部门地址 */
    address?: string;
    /** 创建时间 */
    createdAt?: string;
    /** 更新时间 */
    updatedAt?: string;
    /** 创建人ID */
    creatorId?: number;
    /** 更新人ID */
    updaterId?: number;
    /** 删除时间 */
    deletedAt?: string;
    /** 子部门列表 */
    children?: sysDepartment[];
  };

  type sysDepartmentBatchDeleteRequest = {
    /** 部门ID列表 */
    deptIds: number[];
  };

  type sysDepartmentBatchRequest = {
    /** 部门ID列表 */
    deptIds: number[];
    /** 部门ID列表（兼容字段） */
    ids?: number[];
  };

  type sysDepartmentBatchResponse = {
    /** 成功处理的数量 */
    successCount?: number;
    /** 失败处理的数量 */
    failureCount?: number;
    details?: { id?: number; success?: boolean; message?: string }[];
  };

  type sysDepartmentCreateRequest = {
    /** 父部门ID，0表示顶级部门 */
    parentId: any;
    /** 部门名称 */
    deptName: string;
    /** 部门描述 */
    deptDesc?: string;
    /** 部门类型：1-公司，2-部门，3-小组 */
    deptType: 1 | 2 | 3;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
    /** 部门负责人ID */
    leaderId?: number;
    /** 部门电话 */
    phone?: string;
    /** 部门邮箱 */
    email?: string;
    /** 部门地址 */
    address?: string;
  };

  type sysDepartmentIdParam = {
    /** 部门ID */
    id: number;
  };

  type sysDepartmentListResponse = {
    list?: sysDepartment[];
    pagination?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    };
  };

  type sysDepartmentMemberListResponse = {
    list?: sysUser[];
    pagination?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    };
  };

  type sysDepartmentMemberQueryRequest = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 用户名（模糊查询） */
    userName?: string;
    /** 真实姓名（模糊查询） */
    realName?: string;
    /** 状态 */
    status?: 0 | 1;
  };

  type sysDepartmentMoveRequest = {
    /** 目标父部门ID，null表示移动到顶级 */
    targetParentId: any;
    /** 新的排序顺序 */
    sortOrder?: number;
  };

  type sysDepartmentQueryRequest = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 部门名称（模糊查询） */
    deptName?: string;
    /** 父部门ID */
    parentId?: any;
    /** 部门类型 */
    deptType?: 1 | 2 | 3;
    /** 状态 */
    status?: 0 | 1;
    /** 部门负责人ID */
    leaderId?: number;
  };

  type sysDepartmentStatusUpdateRequest = {
    /** 状态：0-禁用，1-启用 */
    status: 0 | 1;
  };

  type sysDepartmentTreeResponse = {
    /** 部门树结构 */
    tree?: sysDepartment[];
  };

  type sysDepartmentUpdateRequest = {
    /** 部门名称 */
    deptName?: string;
    /** 部门描述 */
    deptDesc?: string;
    /** 部门类型：1-公司，2-部门，3-小组 */
    deptType?: 1 | 2 | 3;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
    /** 部门负责人ID */
    leaderId?: number;
    /** 部门电话 */
    phone?: string;
    /** 部门邮箱 */
    email?: string;
    /** 部门地址 */
    address?: string;
  };

  type sysPermission = {
    /** 权限ID */
    id?: number;
    /** 权限名称 */
    permissionName?: string;
    /** 权限代码 */
    permissionCode?: string;
    /** 权限描述 */
    permissionDesc?: string;
    /** 权限类型：1-菜单，2-按钮，3-接口 */
    permissionType?: 1 | 2 | 3;
    /** 父权限ID，0表示顶级权限 */
    parentId?: number;
    /** 权限路径 */
    path?: string;
    /** 组件路径 */
    component?: string;
    /** 图标 */
    icon?: string;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
    /** 是否为系统权限：0-否，1-是 */
    isSystem?: 0 | 1;
    /** 创建时间 */
    createdAt?: string;
    /** 更新时间 */
    updatedAt?: string;
    /** 创建人ID */
    creatorId?: number;
    /** 更新人ID */
    updaterId?: number;
    /** 删除时间 */
    deletedAt?: string;
    /** 子权限列表 */
    children?: sysPermission[];
  };

  type sysPermissionBatchDeleteRequest = {
    /** 权限ID列表 */
    permissionIds: number[];
  };

  type sysPermissionCreateRequest = {
    /** 权限名称 */
    permissionName: string;
    /** 权限代码 */
    permissionCode: string;
    /** 权限描述 */
    permissionDesc?: string;
    /** 权限类型：1-菜单，2-按钮，3-接口 */
    permissionType: 1 | 2 | 3;
    /** 父权限ID，0表示顶级权限 */
    parentId?: number;
    /** 权限路径 */
    path?: string;
    /** 组件路径 */
    component?: string;
    /** 图标 */
    icon?: string;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
    /** 是否为系统权限：0-否，1-是 */
    isSystem?: 0 | 1;
  };

  type sysPermissionListResponse = {
    list?: sysPermission[];
    pagination?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    };
  };

  type sysPermissionQueryRequest = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 权限名称（模糊查询） */
    permissionName?: string;
    /** 权限代码（模糊查询） */
    permissionCode?: string;
    /** 权限类型 */
    permissionType?: 1 | 2 | 3;
    /** 父权限ID */
    parentId?: number;
    /** 状态 */
    status?: 0 | 1;
    /** 是否为系统权限 */
    isSystem?: 0 | 1;
  };

  type sysPermissionTreeResponse = {
    /** 权限树结构 */
    tree?: sysPermission[];
  };

  type sysPermissionUpdateRequest = {
    /** 权限名称 */
    permissionName?: string;
    /** 权限代码 */
    permissionCode?: string;
    /** 权限描述 */
    permissionDesc?: string;
    /** 权限类型：1-菜单，2-按钮，3-接口 */
    permissionType?: 1 | 2 | 3;
    /** 父权限ID，0表示顶级权限 */
    parentId?: number;
    /** 权限路径 */
    path?: string;
    /** 组件路径 */
    component?: string;
    /** 图标 */
    icon?: string;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
    /** 是否为系统权限：0-否，1-是 */
    isSystem?: 0 | 1;
  };

  type sysRole = {
    /** 角色ID */
    id?: number;
    /** 角色名称 */
    roleName?: string;
    /** 角色描述 */
    roleDesc?: string;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 是否为系统角色：0-否，1-是 */
    isSystem?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
    /** 创建时间 */
    createdAt?: string;
    /** 更新时间 */
    updatedAt?: string;
    /** 创建人ID */
    creatorId?: number;
    /** 更新人ID */
    updaterId?: number;
    /** 删除时间 */
    deletedAt?: string;
  };

  type sysRoleAssignRequest = {
    /** 用户ID */
    userId: number;
    /** 角色ID列表 */
    roleIds: number[];
  };

  type sysRoleBatchDeleteRequest = {
    roleIds: number[];
  };

  type sysRoleCreateRequest = {
    /** 角色名称 */
    roleName: string;
    /** 角色描述 */
    roleDesc?: string;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 是否为系统角色：0-否，1-是 */
    isSystem?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
  };

  type sysRoleListResponse = {
    list?: sysRole[];
    pagination?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    };
  };

  type sysRolePermissionRequest = {
    /** 权限ID列表 */
    permissionIds: number[];
  };

  type sysRoleQueryRequest = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（支持角色名称模糊搜索） */
    search?: string;
    /** 角色名称筛选 */
    roleName?: string;
    /** 状态筛选：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 是否系统角色筛选：0-否，1-是 */
    isSystem?: 0 | 1;
    /** 排序字段 */
    sortBy?:
      | "id"
      | "roleName"
      | "status"
      | "isSystem"
      | "sortOrder"
      | "createdAt"
      | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
    /** 多字段排序配置，优先级从高到低。与sortBy/sortOrder互斥，优先使用sorts */
    sorts?:
      | string
      | {
          field:
            | "id"
            | "roleName"
            | "status"
            | "isSystem"
            | "sortOrder"
            | "createdAt"
            | "updatedAt";
          order: "asc" | "desc";
        }[];
  };

  type sysRoleStatusUpdateRequest = {
    /** 状态：0-禁用，1-启用 */
    status: 0 | 1;
  };

  type sysRoleUpdateRequest = {
    /** 角色名称 */
    roleName?: string;
    /** 角色描述 */
    roleDesc?: string;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
  };

  type sysRoleUserListResponse = {
    list?: sysUser[];
    pagination?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    };
  };

  type sysRoleUserQueryRequest = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（支持用户名、真实姓名模糊搜索） */
    search?: string;
    /** 用户名筛选 */
    username?: string;
    /** 真实姓名筛选 */
    realName?: string;
    /** 状态筛选：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
  };

  type sysUser = {
    /** 用户ID */
    id?: number;
    /** 用户名 */
    username?: string;
    /** 用户邮箱 */
    email?: string;
    /** 手机号 */
    phone?: string;
    /** 真实姓名 */
    realName?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别：0-未知，1-男，2-女 */
    gender?: 0 | 1 | 2;
    /** 出生日期 */
    birthDate?: string;
    /** 状态：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
    /** 最后登录时间 */
    lastLoginTime?: string;
    /** 登录次数 */
    loginCount?: number;
    /** 创建时间 */
    createdAt?: string;
    /** 更新时间 */
    updatedAt?: string;
  };

  type sysUserCreateRequest = {
    /** 用户名 */
    username: string;
    /** 用户邮箱 */
    email: string;
    /** 手机号 */
    phone?: string;
    /** 用户密码 */
    password: string;
    /** 真实姓名 */
    realName: string;
    /** 头像URL */
    avatar?: string;
    /** 性别：0-未知，1-男，2-女 */
    gender?: 0 | 1 | 2;
    /** 出生日期 */
    birthDate?: string;
    /** 状态：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
  };

  type sysUserIdParam = {
    /** 用户ID */
    id: number;
  };

  type sysUserListResponse = {
    list?: sysUser[];
    pagination?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    };
  };

  type sysUserLoginRequest = {
    /** 用户名 */
    username?: string;
    /** 用户邮箱 */
    email?: string;
    /** 用户密码 */
    password: string;
  };

  type sysUserPasswordChangeRequest = {
    /** 新密码 */
    newPassword: string;
    /** 确认密码 */
    confirmPassword?: string;
  };

  type sysUserQueryRequest = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（支持用户名、邮箱、真实姓名、手机号模糊搜索） */
    search?: string;
    /** 用户名筛选 */
    username?: string;
    /** 邮箱筛选 */
    email?: string;
    /** 真实姓名筛选 */
    realName?: string;
    /** 手机号筛选 */
    phone?: string;
    /** 状态筛选：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
    /** 排序字段 */
    sortBy?:
      | "id"
      | "username"
      | "email"
      | "realName"
      | "createdAt"
      | "updatedAt"
      | "lastLoginTime"
      | "status";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type sysUserRefreshTokenRequest = {
    /** 刷新令牌 */
    refreshToken?: string;
  };

  type sysUserSearchRequest = {
    /** 搜索关键词(用户名、邮箱、真实姓名、手机号) */
    search: string;
  };

  type sysUserStatusRequest = {
    /** 状态：0-禁用，1-启用，2-锁定 */
    status: 0 | 1 | 2;
  };

  type sysUserStatusResponse = {
    /** 用户ID */
    id?: number;
    /** 状态：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
  };

  type sysUserTokenResponse = {
    /** JWT访问令牌 */
    accessToken: string;
    /** JWT刷新令牌 */
    refreshToken: string;
    /** 访问令牌过期时间（秒） */
    accessTokenExpiresIn: number;
    /** 刷新令牌过期时间（秒） */
    refreshTokenExpiresIn: number;
    /** 令牌类型 */
    tokenType: string;
  };

  type sysUserUpdateRequest = {
    /** 用户邮箱 */
    email?: string;
    /** 手机号 */
    phone?: string;
    /** 用户密码 */
    password?: string;
    /** 真实姓名 */
    realName?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别：0-未知，1-男，2-女 */
    gender?: 0 | 1 | 2;
    /** 出生日期 */
    birthDate?: string;
    /** 状态：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
  };

  type unauthorizedResponse = {
    code?: number;
    message?: string;
    /** 请求是否成功 */
    success?: boolean;
    /** 错误响应数据为空 */
    data?: null;
    timestamp?: string;
    error?: { type?: string; detail?: string; errorId?: string };
  };

  type updateRoleParams = {
    /** 角色ID */
    id: number;
  };

  type updateRoleStatusParams = {
    /** 角色ID */
    id: number;
  };

  type updateUserParams = {
    /** 用户ID */
    id: number;
  };

  type updateUserPasswordParams = {
    /** 用户ID */
    id: number;
  };

  type updateUserStatusParams = {
    /** 用户ID */
    id: number;
  };
}
