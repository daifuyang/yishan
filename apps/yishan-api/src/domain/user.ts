export interface User {
  id: number;
  email: string;
  username: string;
  password?: string; // 密码是敏感信息，通常在返回用户信息时不包含
  created_at: string;
  updated_at: string;
}

// 用于创建用户的数据传输对象
export interface CreateUserDTO {
  email: string;
  username: string;
  password: string;
}

// 用于更新用户的数据传输对象
export interface UpdateUserDTO {
  username?: string;
  password?: string;
}

// 用于查询用户的数据传输对象
export interface UserQueryDTO {
  email?: string;
  username?: string;
}