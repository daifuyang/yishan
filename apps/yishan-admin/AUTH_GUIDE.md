# 认证系统使用指南

本文档说明如何在yishan-admin项目中使用基于OpenAPI自动生成的认证API。

## 功能概述

- ✅ 支持用户名/邮箱登录
- ✅ JWT Token自动管理
- ✅ Token过期自动刷新
- ✅ 统一错误处理
- ✅ 安全注销
- ✅ 权限控制

## 文件结构

```
src/
├── utils/
│   ├── token.ts          # Token管理工具
│   └── auth.ts          # 认证相关工具
├── pages/user/login/    # 登录页面
└── requestErrorConfig.ts # 全局请求配置
```

## 使用方法

### 1. 登录功能

登录页面已集成OpenAPI自动生成的登录接口，支持用户名和邮箱登录：

```typescript
import { postAuthLogin } from '@/services/yishan-admin/sysAuth';

// 登录调用示例
const response = await postAuthLogin({
  username: 'admin@example.com',  // 可以是用户名或邮箱
  password: 'yourpassword'
});

if (response.code === 200) {
  // 登录成功，token已自动保存
  console.log('登录成功');
}
```

### 2. Token管理

使用`token.ts`中的工具函数管理token：

```typescript
import { 
  getAccessToken, 
  getAuthorizationHeader, 
  isLoggedIn,
  clearTokens 
} from '@/utils/token';

// 获取access token
const token = getAccessToken();

// 获取完整的Authorization头
const authHeader = getAuthorizationHeader(); // "Bearer xxxxxx"

// 检查用户是否已登录
const loggedIn = isLoggedIn();

// 清除所有token
clearTokens();
```

### 3. 用户注销

使用`auth.ts`中的注销功能：

```typescript
import { logout } from '@/utils/auth';

// 用户注销（会自动跳转到登录页）
await logout();

// 静默注销（不跳转）
await logout(false);
```

### 4. 获取用户信息

```typescript
import { getAuthMe } from '@/services/yishan-admin/sysAuth';
import { setCurrentUser } from '@/utils/auth';

// 获取当前用户信息
const userInfo = await getAuthMe();
if (userInfo.code === 200) {
  setCurrentUser(userInfo.data);
}
```

### 5. 权限检查

在路由守卫或组件中使用：

```typescript
import { isLoggedIn } from '@/utils/token';
import { history } from '@umijs/max';

// 在路由守卫中检查权限
if (!isLoggedIn()) {
  history.push('/user/login');
}
```

## 错误处理

系统已配置统一的错误处理，会自动处理以下情况：

- **401 Unauthorized**: 自动注销并跳转到登录页
- **403 Forbidden**: 显示权限不足提示
- **网络错误**: 显示友好的错误提示
- **服务器错误**: 显示具体错误信息

## 配置说明

### 请求拦截器

在`requestErrorConfig.ts`中已配置：
- 自动附加Authorization头
- Token过期自动处理
- 错误统一处理

### Token存储

Token存储在localStorage中：
- `accessToken`: JWT访问令牌
- `refreshToken`: 刷新令牌
- `accessTokenExpiry`: 访问令牌过期时间
- `refreshTokenExpiry`: 刷新令牌过期时间
- `tokenType`: 令牌类型（默认Bearer）

## API接口

### 认证相关

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/v1/auth/login` | POST | 用户登录 |
| `/api/v1/auth/logout` | POST | 用户注销 |
| `/api/v1/auth/me` | GET | 获取当前用户信息 |
| `/api/v1/auth/refresh` | POST | 刷新访问令牌 |

### 请求参数

**登录请求参数**:
```typescript
interface sysUserLoginRequest {
  username: string;  // 用户名或邮箱
  password: string;  // 密码
}
```

**登录响应**:
```typescript
interface sysUserTokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  tokenType: string;
}
```

## 最佳实践

1. **不要在代码中硬编码token**，使用工具函数获取
2. **登录成功后立即获取用户信息**，并缓存到本地
3. **处理所有可能的错误情况**，提供友好的用户提示
4. **定期检查登录状态**，避免token过期导致的用户体验问题
5. **使用环境变量配置API地址**，便于不同环境的部署

## 常见问题

### Q: 如何修改token过期时间？
A: 在后端配置JWT过期时间，前端会自动适配。

### Q: 如何添加记住我功能？
A: 登录时可以设置`refreshTokenExpiresIn`为更长的时间。

### Q: 如何处理并发请求时的token刷新？
A: 系统已自动处理，多个并发请求只会触发一次token刷新。

### Q: 如何测试认证功能？
A: 可以使用以下测试账号：
- 用户名: admin
- 邮箱: admin@example.com
- 密码: 123456