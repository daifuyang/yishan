/**
 * 用户相关的 TypeBox Schema 定义
 */

import { Type, Static } from '@sinclair/typebox'

// 用户基础信息 Schema
export const UserBaseSchema = Type.Object({
  id: Type.String({ description: '用户ID' }),
  username: Type.String({ description: '用户名' }),
  email: Type.String({ format: 'email', description: '邮箱' }),
  phone: Type.Optional(Type.String({ description: '手机号' })),
  realName: Type.String({ description: '真实姓名' }),
  avatar: Type.Optional(Type.String({ description: '头像URL' })),
  gender: Type.Number({ enum: [0, 1, 2], description: '性别（0-未知，1-男，2-女）' }),
  birthDate: Type.Optional(Type.String({ format: 'date', description: '出生日期' })),
  status: Type.Number({ enum: [0, 1, 2], description: '状态（0-禁用，1-启用，2-锁定）' }),
  lastLoginTime: Type.Optional(Type.String({ format: 'date-time', description: '最后登录时间' })),
  lastLoginIp: Type.Optional(Type.String({ description: '最后登录IP' })),
  loginCount: Type.Number({ description: '登录次数' }),
  createdAt: Type.String({ format: 'date-time', description: '创建时间' }),
  updatedAt: Type.String({ format: 'date-time', description: '更新时间' })
}, { $id: 'userBaseSchema' })

// 用户列表查询参数 Schema
export const UserListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ 
    minimum: 1, 
    default: 1, 
    description: '页码' 
  })),
  pageSize: Type.Optional(Type.Integer({ 
    minimum: 1, 
    maximum: 100, 
    default: 10, 
    description: '每页数量' 
  })),
  keyword: Type.Optional(Type.String({ 
    description: '搜索关键词（用户名、邮箱、真实姓名）' 
  })),
  status: Type.Optional(Type.Integer({ 
    enum: [0, 1, 2], 
    description: '用户状态（0-禁用，1-启用，2-锁定）' 
  })),
  sortBy: Type.Optional(Type.String({ 
    enum: ['createdAt', 'updatedAt', 'lastLoginTime', 'loginCount'], 
    default: 'createdAt', 
    description: '排序字段' 
  })),
  sortOrder: Type.Optional(Type.String({ 
    enum: ['asc', 'desc'], 
    default: 'desc', 
    description: '排序方向' 
  }))
}, { $id: 'userListQuerySchema' })

// 用户创建请求 Schema
export const UserCreateSchema = Type.Object({
  username: Type.String({ 
    minLength: 3, 
    maxLength: 50, 
    pattern: '^[a-zA-Z0-9_]+$',
    description: '用户名（3-50位字母数字下划线）' 
  }),
  email: Type.String({ 
    format: 'email', 
    maxLength: 100,
    description: '邮箱地址' 
  }),
  phone: Type.Optional(Type.String({ 
    pattern: '^1[3-9]\\d{9}$',
    description: '手机号码' 
  })),
  password: Type.String({ 
    minLength: 6, 
    maxLength: 20,
    description: '密码（6-20位）' 
  }),
  realName: Type.String({ 
    minLength: 2, 
    maxLength: 50,
    description: '真实姓名' 
  }),
  avatar: Type.Optional(Type.String({ 
    format: 'uri',
    description: '头像URL' 
  })),
  gender: Type.Optional(Type.Number({ 
    enum: [0, 1, 2], 
    default: 0,
    description: '性别（0-未知，1-男，2-女）' 
  })),
  birthDate: Type.Optional(Type.String({ 
    format: 'date',
    description: '出生日期' 
  })),
  status: Type.Optional(Type.Number({ 
    enum: [0, 1], 
    default: 1,
    description: '状态（0-禁用，1-启用）' 
  }))
}, { 
  $id: 'userCreateSchema',
  additionalProperties: false 
})

// 用户更新请求 Schema
export const UserUpdateSchema = Type.Object({
  email: Type.Optional(Type.String({ 
    format: 'email', 
    maxLength: 100,
    description: '邮箱地址' 
  })),
  phone: Type.Optional(Type.String({ 
    pattern: '^1[3-9]\\d{9}$',
    description: '手机号码' 
  })),
  realName: Type.Optional(Type.String({ 
    minLength: 2, 
    maxLength: 50,
    description: '真实姓名' 
  })),
  avatar: Type.Optional(Type.String({ 
    format: 'uri',
    description: '头像URL' 
  })),
  gender: Type.Optional(Type.Number({ 
    enum: [0, 1, 2],
    description: '性别（0-未知，1-男，2-女）' 
  })),
  birthDate: Type.Optional(Type.String({ 
    format: 'date',
    description: '出生日期' 
  })),
  status: Type.Optional(Type.Number({ 
    enum: [0, 1, 2],
    description: '状态（0-禁用，1-启用，2-锁定）' 
  }))
}, { 
  $id: 'userUpdateSchema',
  additionalProperties: false 
})

// 分页响应 Schema
export const PaginationSchema = Type.Object({
  total: Type.Number({ description: '总记录数' }),
  page: Type.Number({ description: '当前页码' }),
  pageSize: Type.Number({ description: '每页数量' }),
  totalPages: Type.Number({ description: '总页数' })
}, { $id: 'paginationSchema' })

// 用户列表响应 Schema
export const UserListResponseSchema = Type.Object({
  code: Type.Number({ example: 10000 }),
  message: Type.String({ example: '获取用户列表成功' }),
  success: Type.Boolean({ example: true }),
  data: Type.Object({
    list: Type.Array(Type.Ref(UserBaseSchema)),
    pagination: Type.Ref(PaginationSchema)
  }),
  timestamp: Type.String({ format: 'date-time' }),
  request_id: Type.String()
}, { $id: 'userListResponseSchema' })

// 用户详情响应 Schema
export const UserDetailResponseSchema = Type.Object({
  code: Type.Number({ example: 10000 }),
  message: Type.String({ example: '获取用户详情成功' }),
  success: Type.Boolean({ example: true }),
  data: Type.Ref(UserBaseSchema),
  timestamp: Type.String({ format: 'date-time' }),
  request_id: Type.String()
}, { $id: 'userDetailResponseSchema' })

// 通用成功响应 Schema
export const SuccessResponseSchema = Type.Object({
  code: Type.Number({ example: 10000 }),
  message: Type.String({ example: '操作成功' }),
  success: Type.Boolean({ example: true }),
  data: Type.Object({}),
  timestamp: Type.String({ format: 'date-time' }),
  request_id: Type.String()
}, { $id: 'successResponseSchema' })

// TypeScript 类型定义（基于 TypeBox Schema）
export type UserListQuery = Static<typeof UserListQuerySchema>
export type UserBase = Static<typeof UserBaseSchema>
export type UserCreateRequest = Static<typeof UserCreateSchema>
export type UserUpdateRequest = Static<typeof UserUpdateSchema>
export type Pagination = Static<typeof PaginationSchema>
export type UserListResponse = Static<typeof UserListResponseSchema>

// 数据层类型定义（用于 Service 层）
export type UserListData = {
  list: UserBase[]
  pagination: Pagination
}

// 保持向后兼容的接口导出
export interface UserListResponseData {
  list: UserBase[]
  pagination: Pagination
}