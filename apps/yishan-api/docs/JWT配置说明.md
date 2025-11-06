# JWT 配置说明

## 概述

JWT（JSON Web Token）配置已经全面支持环境变量配置，提供了灵活的过期时间控制和密钥管理。系统支持将JWT令牌存储到MySQL数据库，确保项目重启后令牌不会丢失。

## 环境变量配置

### 基础配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `JWT_SECRET` | JWT 签名密钥 | `your-secret-key-change-this-in-production` | `your-secure-secret-key` |
| `JWT_EXPIRES_IN` | JWT 默认过期时间（字符串格式） | `24h` | `1h`, `7d`, `30d` |

### Token 过期时间配置（秒）

| 变量名 | 说明 | 默认值 | 换算 |
|--------|------|--------|------|
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | 访问令牌默认过期时间 | `86400` | 24 小时 |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | 刷新令牌默认过期时间 | `604800` | 7 天 |
| `JWT_ACCESS_TOKEN_REMEMBER_ME_EXPIRES_IN` | 记住我模式下访问令牌过期时间 | `2592000` | 30 天 |
| `JWT_REFRESH_TOKEN_REMEMBER_ME_EXPIRES_IN` | 记住我模式下刷新令牌过期时间 | `7776000` | 90 天 |

## 使用示例

### 1. 基础配置
```bash
# .env 文件
JWT_SECRET="your-very-secure-secret-key"
JWT_EXPIRES_IN="24h"
```

### 2. 自定义过期时间
```bash
# 设置访问令牌为 1 小时，刷新令牌为 7 天
JWT_ACCESS_TOKEN_EXPIRES_IN=3600
JWT_REFRESH_TOKEN_EXPIRES_IN=604800

# 设置记住我模式为 30 天和 90 天
JWT_ACCESS_TOKEN_REMEMBER_ME_EXPIRES_IN=2592000
JWT_REFRESH_TOKEN_REMEMBER_ME_EXPIRES_IN=7776000
```

### 3. 生产环境建议
```bash
# 生产环境建议使用强密钥和合理的过期时间
JWT_SECRET="your-production-secret-key-at-least-32-characters-long"
JWT_ACCESS_TOKEN_EXPIRES_IN=1800      # 30 分钟
JWT_REFRESH_TOKEN_EXPIRES_IN=604800   # 7 天
JWT_ACCESS_TOKEN_REMEMBER_ME_EXPIRES_IN=2592000   # 30 天
JWT_REFRESH_TOKEN_REMEMBER_ME_EXPIRES_IN=7776000  # 90 天
```

## 配置中心使用

项目中使用统一的配置中心 `src/config/index.ts` 来管理所有配置：

```typescript
import { JWT_CONFIG } from '../config/index.js'

// 获取访问令牌过期时间
const accessTokenExpiresIn = JWT_CONFIG.accessToken.defaultExpiresIn

// 获取刷新令牌过期时间
const refreshTokenExpiresIn = JWT_CONFIG.refreshToken.defaultExpiresIn

// 获取记住我模式的过期时间
const rememberMeAccessExpiresIn = JWT_CONFIG.accessToken.rememberMeExpiresIn
const rememberMeRefreshExpiresIn = JWT_CONFIG.refreshToken.rememberMeExpiresIn
```

## 登录响应示例

登录接口会根据配置返回相应的过期时间：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "refreshTokenExpiresIn": 604800,
    "expiresAt": 1735689600000,
    "refreshTokenExpiresAt": 1736294400000
  }
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `token` | string | 访问令牌 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `refreshToken` | string | 刷新令牌 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `expiresIn` | number | 访问令牌过期时间（秒） | `86400` |
| `refreshTokenExpiresIn` | number | 刷新令牌过期时间（秒） | `604800` |
| `expiresAt` | number | 访问令牌过期时间戳（毫秒） | `1735689600000` |
| `refreshTokenExpiresAt` | number | 刷新令牌过期时间戳（毫秒） | `1736294400000` |

**时间戳字段优势：**
- `expiresAt` 和 `refreshTokenExpiresAt` 提供精确的过期时间点
- 客户端可以直接使用 `Date.now()` 进行比较，无需计算
- 避免客户端和服务器时间差异导致的判断错误
- 便于前端进行倒计时显示和自动刷新逻辑

## 刷新令牌使用

当访问令牌过期时，可以使用刷新令牌获取新的访问令牌：

### 请求示例
```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 响应示例
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "refreshTokenExpiresIn": 604800,
    "expiresAt": 1735689600000,
    "refreshTokenExpiresAt": 1736294400000
  }
}
```

## 令牌存储机制

系统支持将JWT令牌持久化存储到MySQL数据库，提供以下优势：

### 数据库表结构

**user_token表：**
- `id`: 主键ID
- `user_id`: 关联用户ID
- `access_token`: 访问令牌（唯一索引）
- `refresh_token`: 刷新令牌（唯一索引）
- `access_token_expires_at`: 访问令牌过期时间
- `refresh_token_expires_at`: 刷新令牌过期时间
- `is_revoked`: 是否已撤销
- `revoked_at`: 撤销时间
- `ip_address`: 登录IP地址
- `user_agent`: 用户代理
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `deleted_at`: 删除时间（软删除）

### 核心功能

1. **令牌持久化**：登录时自动存储令牌到数据库
2. **令牌验证**：每次请求都会验证数据库中的令牌有效性
3. **令牌撤销**：登出时自动撤销用户所有活跃令牌
4. **过期清理**：自动清理过期令牌，支持定时任务
5. **多设备支持**：同一用户可拥有多个活跃令牌

### 使用流程

```
登录流程：
1. 用户提交登录凭证
2. 验证用户身份成功
3. 生成JWT令牌
4. 将令牌存储到user_token表
5. 返回令牌给客户端

验证流程：
1. 客户端携带JWT令牌请求
2. 验证JWT签名有效性
3. 查询数据库确认令牌存在且有效
4. 返回用户信息

刷新流程：
1. 客户端提交刷新令牌
2. 验证刷新令牌有效性
3. 查询数据库确认刷新令牌存在
4. 生成新的访问令牌和刷新令牌
5. 更新数据库中的令牌记录
6. 返回新令牌给客户端

登出流程：
1. 客户端提交登出请求
2. 解析JWT获取用户ID
3. 撤销该用户所有活跃令牌
4. 返回登出成功响应
```

## 相关文件

- `src/config/index.ts` - JWT配置定义
- `src/services/auth.service.ts` - 认证服务实现
- `src/schemas/auth.ts` - 认证相关Schema定义
- `src/routes/api/v1/auth/index.ts` - 认证API路由
- `src/models/user-token.model.ts` - 用户令牌模型
- `prisma/schema.prisma` - 数据库Schema定义

## 注意事项

1. **JWT密钥安全**：`JWT_SECRET`必须设置为强随机字符串，建议至少32位字符长度
2. **环境变量优先级**：环境变量配置优先于配置中心配置
3. **Token过期时间**：合理设置过期时间，平衡安全性和用户体验
4. **刷新令牌安全**：刷新令牌应安全存储（如HttpOnly Cookie）避免XSS攻击
5. **令牌轮换**：刷新令牌时生成新令牌以提高安全性
6. **数据库性能**：令牌表会随时间增长，建议定期清理过期数据
7. **多设备管理**：同一用户支持多设备登录，每个设备独立令牌
8. **令牌撤销**：登出时立即撤销所有令牌，确保安全性