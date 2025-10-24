declare namespace API {
  type getAdminUserListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（用户名、邮箱、真实姓名） */
    keyword?: string;
    /** 用户状态（0-禁用，1-启用，2-锁定） */
    status?: 0 | 1 | 2;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "lastLoginTime" | "loginCount";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type paginationResponse = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  type sysUser = {
    /** 用户ID */
    id: string;
    /** 用户名 */
    username: string;
    /** 邮箱 */
    email: string;
    /** 手机号 */
    phone?: string;
    /** 真实姓名 */
    realName: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender: 0 | 1 | 2;
    /** 出生日期 */
    birthDate?: string;
    /** 状态（0-禁用，1-启用，2-锁定） */
    status: 0 | 1 | 2;
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
  };

  type userListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（用户名、邮箱、真实姓名） */
    keyword?: string;
    /** 用户状态（0-禁用，1-启用，2-锁定） */
    status?: 0 | 1 | 2;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "lastLoginTime" | "loginCount";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type userListResponse = {
    code: number;
    message: string;
    success: boolean;
    data: { list: sysUser[]; pagination: paginationResponse };
    timestamp: string;
    request_id: string;
  };
}
