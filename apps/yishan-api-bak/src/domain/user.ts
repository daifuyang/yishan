// 用户性别枚举
export enum Gender {
  UNKNOWN = 0,
  MALE = 1,
  FEMALE = 2
}

// 用户状态枚举
export enum UserStatus {
  DISABLED = 0,
  ENABLED = 1,
  LOCKED = 2
}

// 完整的用户实体接口，匹配数据库sys_user表结构
export interface User {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  salt: string;
  realName: string;
  avatar?: string | null;
  gender: Gender;
  birthDate?: string | null; // ISO date string format
  status: UserStatus;
  lastLoginTime?: string | null; // ISO datetime string
  lastLoginIp?: string | null;
  loginCount: number;
  creatorId?: number | null;
  createdAt: string; // ISO datetime string
  updaterId?: number | null;
  updatedAt: string; // ISO datetime string
  deletedAt?: string | null; // ISO datetime string
  version: number;
}

// 用户公开信息接口（不包含敏感信息）
export interface UserPublic {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  realName: string;
  avatar?: string | null;
  gender: Gender;
  birthDate?: string | null;
  status: UserStatus;
  lastLoginTime?: string | null;
  loginCount: number;
  createdAt: string;
  updatedAt: string;
}

// 用于创建用户的数据传输对象
export interface CreateUserDTO {
  username: string;
  email: string;
  phone?: string | null;
  password: string; // 原始密码，将被加密处理
  realName: string;
  avatar?: string | null;
  gender?: Gender;
  birthDate?: string | null;
  status?: UserStatus;
  creatorId?: number | null;
}

// 用于更新用户的数据传输对象
export interface UpdateUserDTO {
  username?: string;
  email?: string;
  phone?: string | null;
  password?: string;
  realName?: string;
  avatar?: string | null;
  gender?: Gender;
  birthDate?: string | null;
  status?: UserStatus;
  updaterId?: number | null;
}

// 用于查询用户的数据传输对象
export interface UserQueryDTO {
  id?: number;
  username?: string;
  email?: string;
  phone?: string;
  realName?: string;
  status?: UserStatus;
  gender?: Gender;
  creatorId?: number;
  // 统一搜索字段（支持用户名、邮箱、真实姓名、手机号模糊搜索）
  search?: string;
  // 分页参数
  page?: number;
  pageSize?: number;
  // 排序参数
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 用户登录DTO
export interface LoginDTO {
  username?: string;
  email?: string;
  password: string;
}

// 用户登录响应
export interface LoginResponse {
  user: UserPublic;
  token: string;
  expires_in: number;
}

// 更新登录信息DTO
export interface UpdateLoginInfoDTO {
  last_login_time: string;
  last_login_ip: string;
  login_count: number;
}