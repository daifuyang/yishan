declare namespace API {
  type baseResponse = {
    code?: number;
    message?: string;
  };

  type deleteUserParams = {
    /** 用户ID */
    id: number;
  };

  type errorResponse = {
    code?: number;
    message?: string;
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
    sortBy?:
      | "id"
      | "username"
      | "email"
      | "real_name"
      | "created_at"
      | "updated_at"
      | "last_login_time"
      | "status";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type resetUserPasswordParams = {
    /** 用户ID */
    id: number;
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
