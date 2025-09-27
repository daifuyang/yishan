// Token相关的领域模型和接口定义

// 用户令牌实体接口，匹配数据库sys_user_token表结构
export interface UserToken {
  id: number;
  user_id: number;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string; // ISO datetime string
  refresh_token_expires_at: string; // ISO datetime string
  token_type: string;
  client_ip?: string | null;
  user_agent?: string | null;
  is_revoked: boolean;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
  revoked_at?: string | null; // ISO datetime string
}

// 创建令牌的数据传输对象
export interface CreateTokenDTO {
  user_id: number;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: Date;
  refresh_token_expires_at: Date;
  token_type?: string;
  client_ip?: string | null;
  user_agent?: string | null;
  is_revoked?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// 更新令牌的数据传输对象
export interface UpdateTokenDTO {
  access_token?: string;
  refresh_token?: string;
  access_token_expires_at?: Date;
  refresh_token_expires_at?: Date;
  client_ip?: string | null;
  user_agent?: string | null;
  is_revoked?: boolean;
  revoked_at?: Date | null;
  updated_at?: Date;
}

// 令牌查询的数据传输对象
export interface TokenQueryDTO {
  user_id?: number;
  is_revoked?: boolean;
  // 分页参数
  page?: number;
  limit?: number;
  // 排序参数
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// 令牌验证结果
export interface TokenValidationResult {
  isValid: boolean;
  token?: UserToken;
  reason?: string;
}