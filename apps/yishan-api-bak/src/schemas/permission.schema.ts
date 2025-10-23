// 权限管理相关的 schema 定义
export const sysPermissionSchema = {
  $id: "sysPermission",
  type: "object",
  properties: {
    id: { type: "number", description: "权限ID" },
    permissionName: { type: "string", description: "权限名称" },
    permissionCode: { type: "string", description: "权限代码" },
    permissionDesc: { type: "string", description: "权限描述" },
    permissionType: { type: "number", enum: [1, 2, 3], description: "权限类型：1-菜单，2-按钮，3-接口" },
    parentId: { type: "number", description: "父权限ID，0表示顶级权限" },
    path: { type: "string", description: "权限路径" },
    component: { type: "string", description: "组件路径" },
    icon: { type: "string", description: "图标" },
    status: { type: "number", enum: [0, 1], description: "状态：0-禁用，1-启用" },
    sortOrder: { type: "number", description: "排序顺序" },
    isSystem: { type: "number", enum: [0, 1], description: "是否为系统权限：0-否，1-是" },
    createdAt: { type: "string", format: "date-time", description: "创建时间" },
    updatedAt: { type: "string", format: "date-time", description: "更新时间" },
    creatorId: { type: "number", description: "创建人ID" },
    updaterId: { type: "number", description: "更新人ID" },
    deletedAt: { type: "string", format: "date-time", description: "删除时间" },
    children: {
      type: "array",
      items: { $ref: "sysPermission#" },
      description: "子权限列表"
    }
  }
};

export const sysPermissionCreateRequestSchema = {
  $id: "sysPermissionCreateRequest",
  type: "object",
  required: ["permissionName", "permissionCode", "permissionType"],
  properties: {
    permissionName: { type: "string", minLength: 1, maxLength: 50, description: "权限名称" },
    permissionCode: { type: "string", minLength: 1, maxLength: 100, description: "权限代码" },
    permissionDesc: { type: "string", maxLength: 200, description: "权限描述" },
    permissionType: { type: "number", enum: [1, 2, 3], description: "权限类型：1-菜单，2-按钮，3-接口" },
    parentId: { type: "number", default: 0, description: "父权限ID，0表示顶级权限" },
    path: { type: "string", maxLength: 200, description: "权限路径" },
    component: { type: "string", maxLength: 200, description: "组件路径" },
    icon: { type: "string", maxLength: 50, description: "图标" },
    status: { type: "number", enum: [0, 1], default: 1, description: "状态：0-禁用，1-启用" },
    sortOrder: { type: "number", minimum: 0, default: 0, description: "排序顺序" },
    isSystem: { type: "number", enum: [0, 1], default: 0, description: "是否为系统权限：0-否，1-是" }
  }
};

export const sysPermissionQueryRequestSchema = {
  $id: "sysPermissionQueryRequest",
  type: "object",
  properties: {
    page: { type: "number", minimum: 1, default: 1, description: "页码" },
    pageSize: { type: "number", minimum: 1, maximum: 100, default: 10, description: "每页数量" },
    permissionName: { type: "string", description: "权限名称（模糊查询）" },
    permissionCode: { type: "string", description: "权限代码（模糊查询）" },
    permissionType: { type: "number", enum: [1, 2, 3], description: "权限类型" },
    parentId: { type: "number", description: "父权限ID" },
    status: { type: "number", enum: [0, 1], description: "状态" },
    isSystem: { type: "number", enum: [0, 1], description: "是否为系统权限" }
  }
};

export const sysPermissionListResponseSchema = {
  $id: "sysPermissionListResponse",
  type: "object",
  properties: {
    list: {
      type: "array",
      items: { $ref: "sysPermission#" }
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

export const sysPermissionUpdateRequestSchema = {
  $id: "sysPermissionUpdateRequest",
  type: "object",
  properties: {
    permissionName: { type: "string", minLength: 1, maxLength: 50, description: "权限名称" },
    permissionCode: { type: "string", minLength: 1, maxLength: 100, description: "权限代码" },
    permissionDesc: { type: "string", maxLength: 200, description: "权限描述" },
    permissionType: { type: "number", enum: [1, 2, 3], description: "权限类型：1-菜单，2-按钮，3-接口" },
    parentId: { type: "number", description: "父权限ID，0表示顶级权限" },
    path: { type: "string", maxLength: 200, description: "权限路径" },
    component: { type: "string", maxLength: 200, description: "组件路径" },
    icon: { type: "string", maxLength: 50, description: "图标" },
    status: { type: "number", enum: [0, 1], description: "状态：0-禁用，1-启用" },
    sortOrder: { type: "number", minimum: 0, description: "排序顺序" },
    isSystem: { type: "number", enum: [0, 1], description: "是否为系统权限：0-否，1-是" }
  }
};

export const sysPermissionTreeResponseSchema = {
  $id: "sysPermissionTreeResponse",
  type: "object",
  properties: {
    tree: {
      type: "array",
      items: { $ref: "sysPermission#" },
      description: "权限树结构"
    }
  }
};

export const sysPermissionBatchDeleteRequestSchema = {
  $id: "sysPermissionBatchDeleteRequest",
  type: "object",
  required: ["permissionIds"],
  properties: {
    permissionIds: { 
      type: "array", 
      items: { type: "number" },
      minItems: 1,
      description: "权限ID列表" 
    }
  }
};

export const sysRolePermissionRequestSchema = {
  $id: "sysRolePermissionRequest",
  type: "object",
  required: ["permissionIds"],
  properties: {
    permissionIds: { 
      type: "array", 
      items: { type: "number" },
      description: "权限ID列表" 
    }
  }
};