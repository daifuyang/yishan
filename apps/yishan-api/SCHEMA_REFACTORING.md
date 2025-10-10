# Schema 重构总结

## 改进概述

本次重构基于 Fastify 官方文档的最佳实践，使用 `addSchema` 和 `$ref` 完成了类型引用的优化，显著提升了代码的可维护性和可读性。

## 主要变更

### 1. 创建独立 Schema 文件

创建了 `/src/schemas/auth.schema.ts` 文件，集中管理所有认证相关的 JSON Schema：

- `userSchema` - 用户详细信息 schema
- `tokenResponseSchema` - Token 响应 schema
- `loginRequestSchema` - 登录请求 schema
- `refreshTokenRequestSchema` - 刷新 token 请求 schema
- `baseResponseSchema` - 基础响应 schema
- `errorResponseSchema` - 错误响应 schema
- `unauthorizedResponseSchema` - 未授权响应 schema

### 2. 使用 $ref 引用

在 `/src/routes/api/v1/auth.ts` 中，使用 `$ref` 替代了重复的 schema 定义：

#### 重构前：
```typescript
response: {
  200: {
    type: 'object',
    properties: {
      code: { type: 'number', example: 200 },
      message: { type: 'string', example: '登录成功' },
      data: {
        type: 'object',
        properties: {
          id: { type: 'number', description: '用户ID' },
          username: { type: 'string', description: '用户名' },
          // ... 13个字段的重复定义
        }
      }
    }
  }
}
```

#### 重构后：
```typescript
response: {
  200: {
    type: 'object',
    properties: {
      code: { type: 'number', example: 200 },
      message: { type: 'string', example: '登录成功' },
      data: { $ref: 'user#' }
    }
  }
}
```

### 3. 统一 Schema 管理

所有 schema 通过 `fastify.addSchema()` 统一注册，确保：
- 全局唯一性
- 易于维护和更新
- 避免重复定义
- 支持跨路由复用

## 优势

1. **DRY 原则**：消除重复代码，避免多处维护同一 schema
2. **可维护性**：集中管理 schema，修改只需在一个地方进行
3. **类型安全**：Schema 定义与 TypeScript 类型保持一致
4. **文档清晰**：每个 schema 都有清晰的用途和描述
5. **扩展性**：新增路由可以轻松复用现有 schema

## 文件结构

```
src/
├── routes/
│   └── api/
│       └── v1/
│           └── auth.ts (使用 $ref 引用)
├── schemas/
│   ├── auth.schema.ts (所有认证相关 schema)
│   └── index.ts (导出所有 schema)
```

## 使用示例

新的路由定义更加简洁：

```typescript
fastify.post('/auth/login', {
  schema: {
    body: { $ref: 'loginRequest#' },
    response: {
      200: {
        type: 'object',
        properties: {
          code: { type: 'number', example: 200 },
          message: { type: 'string', example: '登录成功' },
          data: { $ref: 'tokenResponse#' }
        }
      },
      400: { $ref: 'errorResponse#' },
      401: { $ref: 'errorResponse#' },
      404: { $ref: 'errorResponse#' }
    }
  }
})
```

## 验证

所有 schema 都经过验证：
- ✅ Schema 格式正确
- ✅ $ref 引用有效
- ✅ 类型定义完整
- ✅ 描述信息清晰