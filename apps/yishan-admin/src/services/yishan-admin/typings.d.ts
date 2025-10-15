declare namespace API {
  type baseResponse = {
    code?: number;
    message?: string;
    /** 请求是否成功 */
    isSuccess?: boolean;
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
    isSuccess?: boolean;
    /** 错误响应数据为空 */
    data?: null;
    error?: {
      type?: string;
      detail?: string;
      errorId?: string;
      validation?: Record<string, any>;
    };
  };

  type getRoleDetailParams = {
    /** ID */
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
  };

  type getUserBySearchParams = {
    /** 搜索关键词(用户名、邮箱、真实姓名、手机号) */
    search: string;
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
    refreshToken: string;
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
    isSuccess?: boolean;
    /** 错误响应数据为空 */
    data?: null;
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

  type updateUserStatusParams = {
    /** 用户ID */
    id: number;
  };
}
