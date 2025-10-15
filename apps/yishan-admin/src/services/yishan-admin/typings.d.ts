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
    /** 角色ID */
    id: number;
  };

  type getRoleListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（支持角色名称、描述模糊搜索） */
    search?: string;
    /** 角色名称筛选 */
    name?: string;
    /** 角色类型筛选 */
    type?: "system" | "custom";
    /** 状态筛选：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序字段 */
    sortBy?: "id" | "name" | "sort_order" | "created_at" | "updated_at";
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
    real_name?: string;
    /** 手机号筛选 */
    phone?: string;
    /** 状态筛选：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
    /** 排序字段 */
    sort_by?:
      | "id"
      | "username"
      | "email"
      | "real_name"
      | "created_at"
      | "updated_at"
      | "last_login_time"
      | "status";
    /** 排序方向 */
    sort_order?: "asc" | "desc";
  };

  type getUserRolesParams = {
    /** 用户ID */
    userId: number;
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

  type sysUserLoginRequest = {
    /** 用户名 */
    username?: string;
    /** 用户邮箱 */
    email?: string;
    /** 用户密码 */
    password: string;
  };

  type sysUserRefreshTokenRequest = {
    /** 刷新令牌 */
    refreshToken: string;
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
