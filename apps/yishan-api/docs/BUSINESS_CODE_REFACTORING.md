# 业务码重构设计文档

## 背景

当前项目的业务码设计存在以下问题：
1. 成功状态过度细分，每个操作都有独立的成功码
2. 业务码数量庞大，维护复杂度高
3. 缺乏统一的错误分类和处理机制

## 设计理念

参考支付宝开放平台的设计规范，采用以下原则：

### 1. 统一成功码
- **所有成功操作统一使用 `10000`**
- 具体操作类型通过 `message` 字段区分
- 简化业务码管理，减少维护成本

### 2. 分层错误码设计
```
错误码分类：
├── 公共错误码 (20xxx-23xxx)
│   ├── 系统错误 (20xxx)
│   ├── 参数错误 (21xxx)
│   └── 权限错误 (22xxx)
└── 业务错误码 (30xxx-99xxx)
    ├── 用户模块 (30xxx)
    ├── 部门模块 (31xxx)
    ├── 角色模块 (32xxx)
    └── 其他业务模块...
```

### 3. 二级错误码支持
- 主错误码：数字形式，便于程序处理
- 子错误码：字符串形式，便于错误定位
- 格式：`module.specific_error`

## 新的业务码结构

### 成功码
```typescript
export const SUCCESS_CODE = 10000;
```

### 公共错误码
```typescript
export const ErrorCode = {
  // 系统错误 (20xxx)
  SYSTEM_ERROR: 20001,
  DATABASE_ERROR: 20002,
  NETWORK_ERROR: 20003,
  SERVICE_UNAVAILABLE: 20004,
  
  // 参数错误 (21xxx)
  INVALID_PARAMETER: 21001,
  MISSING_PARAMETER: 21002,
  VALIDATION_ERROR: 21003,
  
  // 权限错误 (22xxx)
  UNAUTHORIZED: 22001,
  TOKEN_EXPIRED: 22002,
  TOKEN_INVALID: 22003,
  FORBIDDEN: 22004,
  INSUFFICIENT_PERMISSIONS: 22005,
} as const;
```

### 错误码常量
```typescript
export const ErrorCode = {
  // 系统错误 (20xxx)
  SYSTEM_ERROR: 20001,
  DATABASE_ERROR: 20002,
  NETWORK_ERROR: 20003,
  SERVICE_UNAVAILABLE: 20004,
  
  // 参数错误 (21xxx)
  INVALID_PARAMETER: 21001,
  MISSING_PARAMETER: 21002,
  VALIDATION_ERROR: 21003,
  
  // 权限错误 (22xxx)
  UNAUTHORIZED: 22001,
  TOKEN_EXPIRED: 22002,
  TOKEN_INVALID: 22003,
  FORBIDDEN: 22004,
  INSUFFICIENT_PERMISSIONS: 22005,
  
  // 请求错误 (23xxx)
  METHOD_NOT_ALLOWED: 23001,
  TOO_MANY_REQUESTS: 23002,
  REQUEST_ENTITY_TOO_LARGE: 23003,
  
  // 用户模块 (30xxx)
  USER_NOT_FOUND: 30001,
  USER_ALREADY_EXISTS: 30002,
  USER_ACCOUNT_LOCKED: 30003,
  USER_ACCOUNT_DISABLED: 30004,
  INVALID_CREDENTIALS: 30005,
  INVALID_PASSWORD_FORMAT: 30006,
  
  // 部门模块 (31xxx)
  DEPARTMENT_NOT_FOUND: 31001,
  DEPARTMENT_ALREADY_EXISTS: 31002,
  DEPARTMENT_HAS_CHILDREN: 31003,
  DEPARTMENT_HAS_USERS: 31004,
  
  // 角色模块 (32xxx)
  ROLE_NOT_FOUND: 32001,
  ROLE_ALREADY_EXISTS: 32002,
  ROLE_IN_USE: 32003,
} as const;
```

### 子错误码
```typescript
export const SubErrorCode = {
  // 用户相关
  'user.not_found': '用户不存在',
  'user.already_exists': '用户已存在',
  'user.password_incorrect': '密码错误',
  
  // 部门相关
  'department.not_found': '部门不存在',
  'department.name_duplicate': '部门名称重复',
  'department.has_children': '部门下存在子部门',
  'department.has_users': '部门下存在用户',
  
  // 角色相关
  'role.not_found': '角色不存在',
  'role.name_duplicate': '角色名称重复',
  'role.in_use': '角色正在使用中',
} as const;
```

## 响应格式

### 成功响应
```typescript
{
  "success": true,
  "code": 10000,
  "message": "创建成功",
  "data": {
    // 业务数据
  }
}
```

### 错误响应
```typescript
{
  "success": false,
  "code": 31002,
  "message": "部门名称重复",
  "sub_code": "department.name_duplicate",
  "sub_message": "部门名称重复，请使用其他名称",
  "data": null
}
```
> HTTP 状态码：409（冲突）

## 优势

1. **简化成功处理**：统一成功码，减少不必要的业务码
2. **精细化错误处理**：分层错误码便于错误定位和处理
3. **易于维护**：清晰的分类和编码规则
4. **便于扩展**：预留足够的编码空间
5. **符合行业标准**：参考支付宝等大厂的最佳实践

## 迁移策略

1. **渐进式迁移**：新接口使用新规范，旧接口保持兼容
2. **工具类更新**：更新 ResponseUtil 支持新格式
3. **文档同步**：更新 API 文档说明新的错误码规范
4. **前端适配**：前端代码适配新的响应格式

## 实施计划

- [ ] 实现新的业务码常量定义
- [ ] 更新 ResponseUtil 工具类
- [ ] 创建迁移示例
- [ ] 更新相关文档
- [ ] 逐步迁移现有接口