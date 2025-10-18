// 角色管理相关的 schema 定义
export const sysRoleSchema = {
  $id: "sysRole",
  type: "object",
  properties: {
    id: { type: "number", description: "角色ID" },
    roleName: { type: "string", description: "角色名称" },
    roleDesc: { type: "string", description: "角色描述" },
    status: { type: "number", enum: [0, 1], description: "状态：0-禁用，1-启用" },
    isSystem: { type: "number", enum: [0, 1], description: "是否为系统角色：0-否，1-是" },
    sortOrder: { type: "number", description: "排序顺序" },
    createdAt: { type: "string", format: "date-time", description: "创建时间" },
    updatedAt: { type: "string", format: "date-time", description: "更新时间" },
    creatorId: { type: "number", description: "创建人ID" },
    updaterId: { type: "number", description: "更新人ID" },
    deletedAt: { type: "string", format: "date-time", description: "删除时间" }
  }
};

export const sysRoleCreateRequestSchema = {
  $id: "sysRoleCreateRequest",
  type: "object",
  required: ["roleName"],
  properties: {
    roleName: { type: "string", minLength: 2, maxLength: 50, description: "角色名称" },
    roleDesc: { type: "string", maxLength: 200, description: "角色描述" },
    status: { type: "number", enum: [0, 1], default: 1, description: "状态：0-禁用，1-启用" },
    isSystem: { type: "number", enum: [0, 1], default: 0, description: "是否为系统角色：0-否，1-是" },
    sortOrder: { type: "number", minimum: 0, default: 0, description: "排序顺序" }
  }
};

export const sysRoleQueryRequestSchema = {
  $id: "sysRoleQueryRequest",
  type: "object",
  properties: {
    page: { type: "number", minimum: 1, default: 1, description: "页码" },
    pageSize: { type: "number", minimum: 1, maximum: 100, default: 10, description: "每页数量" },
    search: { type: "string", description: "搜索关键词（支持角色名称模糊搜索）" },
    roleName: { type: "string", description: "角色名称筛选" },
    status: { 
      type: "number", 
      enum: [0, 1], 
      description: "状态筛选：0-禁用，1-启用" 
    },
    isSystem: {
      type: "number",
      enum: [0, 1],
      description: "是否系统角色筛选：0-否，1-是"
    },
    sortBy: { 
      type: "string", 
      enum: ["id", "roleName", "status", "isSystem", "sortOrder", "createdAt", "updatedAt"],
      default: "sortOrder",
      description: "排序字段" 
    },
    sortOrder: { 
      type: "string", 
      enum: ["asc", "desc"], 
      default: "asc",
      description: "排序方向" 
    }
  }
};

export const sysRoleListResponseSchema = {
  $id: "sysRoleListResponse",
  type: "object",
  properties: {
    list: {
      type: "array",
      items: { $ref: "sysRole#" }
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

export const idParamSchema = {
  $id: "idParam",
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "number", description: "ID" }
  }
};

export const sysRoleUpdateRequestSchema = {
  $id: "sysRoleUpdateRequest",
  type: "object",
  properties: {
    roleName: { type: "string", minLength: 2, maxLength: 50, description: "角色名称" },
    roleDesc: { type: "string", maxLength: 200, description: "角色描述" },
    status: { type: "number", enum: [0, 1], description: "状态：0-禁用，1-启用" },
    sortOrder: { type: "number", minimum: 0, description: "排序顺序" }
  }
};

export const sysRoleAssignRequestSchema = {
  $id: "sysRoleAssignRequest",
  type: "object",
  required: ["userId", "roleIds"],
  properties: {
    userId: { type: "number", description: "用户ID" },
    roleIds: { 
      type: "array", 
      items: { type: "number" },
      description: "角色ID列表" 
    }
  }
};

export const sysRoleStatusUpdateRequestSchema = {
  $id: "sysRoleStatusUpdateRequest",
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "number", enum: [0, 1], description: "状态：0-禁用，1-启用" }
  }
};

export const sysRoleBatchDeleteRequestSchema = {
  $id: "sysRoleBatchDeleteRequest",
  type: "object",
  required: ["roleIds"],
  properties: {
    roleIds: { type: "array", items: { type: "number" } }
  }
};
