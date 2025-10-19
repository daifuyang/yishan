// 用户管理相关的 schema 定义
export const sysUserCreateRequestSchema = {
  $id: "sysUserCreateRequest",
  type: "object",
  required: ["username", "email", "password", "realName"],
  properties: {
    username: { type: "string", description: "用户名" },
    email: { type: "string", format: "email", description: "用户邮箱" },
    phone: { type: "string", description: "手机号" },
    password: { type: "string", minLength: 6, description: "用户密码" },
    realName: { type: "string", description: "真实姓名" },
    avatar: { type: "string", description: "头像URL" },
    gender: {
      type: "number",
      enum: [0, 1, 2],
      description: "性别：0-未知，1-男，2-女",
    },
    birthDate: { type: "string", format: "date", description: "出生日期" },
    status: {
      type: "number",
      enum: [0, 1, 2],
      description: "状态：0-禁用，1-启用，2-锁定",
      default: 1,
    },
  },
};

export const sysUserQueryRequestSchema = {
  $id: "sysUserQueryRequest",
  type: "object",
  properties: {
    page: { type: "number", minimum: 1, default: 1, description: "页码" },
    pageSize: { type: "number", minimum: 1, maximum: 100, default: 10, description: "每页数量" },
    search: { type: "string", description: "搜索关键词（支持用户名、邮箱、真实姓名、手机号模糊搜索）" },
    username: { type: "string", description: "用户名筛选" },
    email: { type: "string", description: "邮箱筛选" },
    realName: { type: "string", description: "真实姓名筛选" },
    phone: { type: "string", description: "手机号筛选" },
    status: { 
      type: "number", 
      enum: [0, 1, 2], 
      description: "状态筛选：0-禁用，1-启用，2-锁定" 
    },
    sortBy: { 
      type: "string", 
      enum: ["id", "username", "email", "realName", "createdAt", "updatedAt", "lastLoginTime", "status"],
      default: "createdAt",
      description: "排序字段" 
    },
    sortOrder: { 
      type: "string", 
      enum: ["asc", "desc"], 
      default: "desc",
      description: "排序方向" 
    },
  },
};

export const sysUserListResponseSchema = {
  $id: "sysUserListResponse",
  type: "object",
  properties: {
    list: {
      type: "array",
      items: { $ref: "sysUser#" },
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "number", description: "当前页码" },
        pageSize: { type: "number", description: "每页条数" },
        total: { type: "number", description: "总记录数" },
        totalPages: { type: "number", description: "总页数" },
      },
    },
  },
};

export const sysUserSearchRequestSchema = {
  $id: "sysUserSearchRequest",
  type: "object",
  required: ["search"],
  properties: {
    search: { type: "string", description: "搜索关键词(用户名、邮箱、真实姓名、手机号)" },
  },
};

export const sysUserIdParamSchema = {
  $id: "sysUserIdParam",
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "number", description: "用户ID" },
  },
};

export const sysUserUpdateRequestSchema = {
  $id: "sysUserUpdateRequest",
  type: "object",
  properties: {
    email: { type: "string", format: "email", description: "用户邮箱" },
    phone: { type: "string", description: "手机号" },
    password: { type: "string", minLength: 6, description: "用户密码" },
    realName: { type: "string", description: "真实姓名" },
    avatar: { type: "string", description: "头像URL" },
    gender: {
      type: "number",
      enum: [0, 1, 2],
      description: "性别：0-未知，1-男，2-女",
    },
    birthDate: { type: "string", format: "date", description: "出生日期" },
    status: {
      type: "number",
      enum: [0, 1, 2],
      description: "状态：0-禁用，1-启用，2-锁定",
    },
  },
};

export const sysUserStatusRequestSchema = {
  $id: "sysUserStatusRequest",
  type: "object",
  required: ["status"],
  properties: {
    status: {
      type: "number",
      enum: [0, 1, 2],
      description: "状态：0-禁用，1-启用，2-锁定",
    },
  },
};

export const sysUserStatusResponseSchema = {
  $id: "sysUserStatusResponse",
  type: "object",
  properties: {
    id: { type: "number", description: "用户ID" },
    status: {
      type: "number",
      enum: [0, 1, 2],
      description: "状态：0-禁用，1-启用，2-锁定",
    },
  },
};

export const sysRoleUserQueryRequestSchema = {
  $id: "sysRoleUserQueryRequest",
  type: "object",
  properties: {
    page: { type: "number", minimum: 1, default: 1, description: "页码" },
    pageSize: { type: "number", minimum: 1, maximum: 100, default: 10, description: "每页数量" },
    search: { type: "string", description: "搜索关键词（支持用户名、真实姓名模糊搜索）" },
    username: { type: "string", description: "用户名筛选" },
    realName: { type: "string", description: "真实姓名筛选" },
    status: { 
      type: "number", 
      enum: [0, 1, 2], 
      description: "状态筛选：0-禁用，1-启用，2-锁定" 
    }
  }
};

export const sysRoleUserListResponseSchema = {
  $id: "sysRoleUserListResponse",
  type: "object",
  properties: {
    list: {
      type: "array",
      items: { $ref: "sysUser#" }
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "number", description: "当前页码" },
        pageSize: { type: "number", description: "每页条数" },
        total: { type: "number", description: "总记录数" },
        totalPages: { type: "number", description: "总页数" }
      }
    }
  }
};

export const sysUserPasswordChangeRequestSchema = {
  $id: "sysUserPasswordChangeRequest",
  type: "object",
  required: ["newPassword"],
  additionalProperties: false,
  properties: {
    newPassword: { 
      type: "string", 
      minLength: 6, 
      description: "新密码" 
    },
    confirmPassword: { 
      type: "string", 
      minLength: 6, 
      description: "确认密码" 
    }
  }
};