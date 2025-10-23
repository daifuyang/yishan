/**
 * 企业级用户类型设计规范
 * 基于领域驱动设计(DDD)和Clean Architecture原则
 */

// 基础枚举定义保持不变，但添加更多状态
export enum Gender {
  UNKNOWN = 0,
  MALE = 1,
  FEMALE = 2,
  OTHER = 3 // 新增：更包容的性别选项
}

export enum UserStatus {
  DISABLED = 0,
  ENABLED = 1,
  LOCKED = 2,
  PENDING = 3, // 新增：待激活状态
  EXPIRED = 4  // 新增：已过期状态
}

// 新增：用户角色枚举
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  GUEST = 'guest'
}

// 新增：账户类型枚举
export enum AccountType {
  LOCAL = 'local',
  LDAP = 'ldap',
  OAUTH2 = 'oauth2',
  SAML = 'saml'
}

// 1. 基础值对象 (Value Objects)
export interface Email {
  value: string;
  verified: boolean;
  verifiedAt?: Date;
}

export interface Phone {
  value: string;
  verified: boolean;
  verifiedAt?: Date;
  countryCode?: string;
}

export interface AuditInfo {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
  updatedBy?: number;
  version: number;
}

// 2. 用户聚合根 (Aggregate Root)
export interface User {
  id: number;
  
  // 身份认证信息
  username: string;
  email: Email;
  phone?: Phone;
  
  // 安全信息
  password: {
    hash: string;
    salt: string;
    algorithm: string; // bcrypt, scrypt, argon2等
    lastChangedAt: Date;
    mustChange: boolean;
  };
  
  // 个人信息
  profile: {
    realName: string;
    avatar?: string;
    gender: Gender;
    birthDate?: Date;
    timezone?: string;
    locale?: string;
  };
  
  // 权限和角色
  roles: UserRole[];
  permissions: string[];
  
  // 账户状态
  status: UserStatus;
  accountType: AccountType;
  
  // 登录统计
  loginStats: {
    lastLoginAt?: Date;
    lastLoginIP?: string;
    loginCount: number;
    failedLoginCount: number;
    lastFailedLoginAt?: Date;
  };
  
  // 审计信息
  audit: AuditInfo;
  
  // 软删除
  deletedAt?: Date;
  deletedBy?: number;
  
  // 扩展字段
  metadata?: Record<string, any>;
}

// 3. 领域事件
export interface UserCreatedEvent {
  userId: number;
  username: string;
  email: string;
  createdAt: Date;
}

export interface UserUpdatedEvent {
  userId: number;
  changes: Partial<User>;
  updatedAt: Date;
  updatedBy: number;
}

// 4. 数据传输对象 (DTOs) - 使用严格的验证规则
export interface CreateUserCommand {
  username: string; // 3-20字符，字母数字下划线
  email: string;    // 有效的邮箱格式
  password: string; // 最少8字符，包含大小写、数字、特殊字符
  phone?: string;   // 可选，手机号格式验证
  realName: string; // 2-50字符
  avatar?: string;  // URL格式验证
  gender?: Gender;
  birthDate?: string; // ISO 8601格式
  timezone?: string; // IANA时区格式
  locale?: string; // BCP 47语言标签
  roles?: UserRole[];
  createdBy?: number;
}

export interface UpdateUserCommand {
  username?: string;
  email?: string;
  phone?: string;
  realName?: string;
  avatar?: string;
  gender?: Gender;
  birthDate?: string;
  timezone?: string;
  locale?: string;
  roles?: UserRole[];
  status?: UserStatus;
  updatedBy: number;
}

export interface ChangePasswordCommand {
  currentPassword?: string; // 当前密码（可选，管理员重置时可不提供）
  newPassword: string;      // 新密码，需符合密码策略
  updatedBy: number;
}

// 5. 查询参数对象
export interface UserQueryCriteria {
  // 精确匹配
  id?: number;
  username?: string;
  email?: string;
  phone?: string;
  status?: UserStatus;
  roles?: UserRole[];
  
  // 模糊搜索
  search?: string; // 全局搜索：用户名、邮箱、姓名
  
  // 范围查询
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  
  // 分页和排序
  page?: number;
  pageSize?: number;
  sortBy?: 'id' | 'username' | 'email' | 'realName' | 'createdAt' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
  
  // 包含关联数据
  includeRoles?: boolean;
  includePermissions?: boolean;
  includeLoginStats?: boolean;
}

// 6. 响应对象
export interface UserResponse {
  id: number;
  username: string;
  email: Email;
  phone?: Phone;
  profile: {
    realName: string;
    avatar?: string;
    gender: Gender;
    birthDate?: string; // ISO格式
    timezone: string;
    locale: string;
  };
  roles: UserRole[];
  status: UserStatus;
  loginStats: {
    lastLoginAt?: string; // ISO格式
    lastLoginIP?: string;
    loginCount: number;
  };
  createdAt: string; // ISO格式
  updatedAt: string; // ISO格式
}

// 7. 分页响应
export interface PaginatedUserResponse {
  data: UserResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// 8. 验证规则常量
export const USER_VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 20,
    PATTERN: /^[a-zA-Z0-9_-]+$/
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL_CHAR: true
  },
  EMAIL: {
    MAX_LENGTH: 254,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  REAL_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50
  },
  PHONE: {
    PATTERN: /^\+?[\d\s-()]+$/
  }
} as const;