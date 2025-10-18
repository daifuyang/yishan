// 角色状态枚举
export enum RoleStatus {
  DISABLED = 0,
  ENABLED = 1
}

// 角色类型枚举
export enum RoleType {
  SYSTEM = 'system',    // 系统角色（不可删除）
  CUSTOM = 'custom'     // 自定义角色（可删除）
}

// 完整的角色实体接口，匹配数据库sys_role表结构
export interface Role {
  id: number;
  roleName: string;
  roleDesc?: string | null;
  status: RoleStatus;
  isSystem: number; // 0-否，1-是
  sortOrder: number; // 排序顺序，数值越小越靠前
  creatorId?: number | null;
  createdAt: string; // ISO datetime string
  updaterId?: number | null;
  updatedAt: string; // ISO datetime string
  deletedAt?: string | null; // ISO datetime string
}

// 角色公开信息接口
export interface RolePublic {
  id: number;
  roleName: string;
  roleDesc?: string | null;
  status: RoleStatus;
  isSystem: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// 用于创建角色的数据传输对象
export interface CreateRoleDTO {
  roleName: string;
  roleDesc?: string | null;
  type?: RoleType;
  status?: RoleStatus;
  sortOrder?: number;
  creatorId?: number | null;
}

// 用于更新角色的数据传输对象
export interface UpdateRoleDTO {
  roleName?: string;
  roleDesc?: string | null;
  status?: RoleStatus;
  sortOrder?: number;
  updaterId?: number | null;
}

// 角色查询数据传输对象
export interface RoleQueryDTO {
  id?: number;
  roleName?: string;
  code?: string;
  type?: RoleType;
  status?: RoleStatus;
  creatorId?: number;
  // 搜索关键词
  search?: string;
  // 分页参数
  page?: number;
  pageSize?: number;
  // 排序参数
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 角色权限关联接口
export interface RolePermission {
  id: number;
  role_id: number;
  permission_id: number;
  created_at: string;
  updated_at: string;
}

// 用户角色关联接口
export interface UserRole {
  id: number;
  user_id: number;
  role_id: number;
  assigned_by?: number | null;
  assigned_at: string;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

// 角色分配DTO
export interface AssignRoleDTO {
  userId: number;
  roleIds: number[];
  assignedBy?: number;
  expiresAt?: string | null;
}

// 角色权限分配DTO
export interface AssignPermissionDTO {
  roleId: number;
  permissionIds: number[];
  assignedBy?: number;
}

// 批量删除角色DTO
export interface BatchDeleteRoleDTO {
  roleIds: number[];
  deleterId?: number;
}