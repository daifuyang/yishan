# 依山 API 接口规范文档

## 接口设计原则

### RESTful 设计规范

1. **资源导向**: URL 应该表示资源，而不是动作
2. **HTTP 方法**: 使用标准 HTTP 方法表示操作类型
3. **状态码**: 使用正确的 HTTP 状态码
4. **版本控制**: 在 URL 中包含 API 版本

### URL 结构

```
https://api.yishan.com/api/v1/{资源}/{id}/{子资源}
```

### 标准端点模式

| 操作 | HTTP方法 | URL | 描述 |
|------|----------|-----|------|
| 创建 | POST | /api/v1/users | 创建新资源 |
| 查询列表 | GET | /api/v1/users | 获取资源列表 |
| 查询单个 | GET | /api/v1/users/:id | 获取单个资源 |
| 更新 | PUT | /api/v1/users/:id | 完整更新资源 |
| 部分更新 | PATCH | /api/v1/users/:id | 部分更新资源 |
| 删除 | DELETE | /api/v1/users/:id | 删除资源 |

## 请求规范

### 请求头

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>
```

### 查询参数

#### 分页参数
```http
GET /api/v1/users?page=1&limit=20&sort=created_at&order=desc
```

#### 过滤参数
```http
GET /api/v1/users?email=example@domain.com&status=active
```

#### 搜索参数
```http
GET /api/v1/users?search=keyword&search_fields=name,email
```

### 请求体示例

#### 创建用户
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securePassword123"
}
```

#### 更新用户
```json
{
  "username": "newusername",
  "profile": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

## 响应规范

### 统一响应格式

#### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid-123456"
  }
}
```

#### 列表响应
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "email": "user1@example.com",
      "username": "user1"
    },
    {
      "id": 2,
      "email": "user2@example.com",
      "username": "user2"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5,
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid-123456"
  }
}
```

### 错误响应格式

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "email",
        "message": "邮箱格式不正确"
      },
      {
        "field": "password",
        "message": "密码长度至少8位"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid-123456"
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "未提供有效的认证令牌"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid-123456"
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "请求的资源不存在"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid-123456"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "服务器内部错误"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid-123456"
  }
}
```

## 状态码规范

### 2xx 成功
- `200 OK` - 请求成功
- `201 Created` - 资源创建成功
- `204 No Content` - 请求成功但无返回内容

### 4xx 客户端错误
- `400 Bad Request` - 请求参数错误
- `401 Unauthorized` - 未认证
- `403 Forbidden` - 无权限
- `404 Not Found` - 资源不存在
- `409 Conflict` - 资源冲突
- `422 Unprocessable Entity` - 请求格式正确但语义错误

### 5xx 服务器错误
- `500 Internal Server Error` - 服务器内部错误
- `502 Bad Gateway` - 网关错误
- `503 Service Unavailable` - 服务不可用

## 认证和授权

### JWT Token

#### 获取 Token
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 使用 Token
```http
GET /api/v1/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 权限控制

- 使用基于角色的访问控制 (RBAC)
- 在请求头中包含用户角色信息
- 实现资源级别的权限检查

## 分页规范

### 请求参数
```http
GET /api/v1/users?page=1&limit=20&sort=created_at&order=desc
```

### 响应格式
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

### 默认值
- page: 1
- limit: 20 (最大 100)
- sort: created_at
- order: desc

## 过滤和搜索

### 过滤参数
```http
GET /api/v1/users?status=active&role=admin
```

### 搜索参数
```http
GET /api/v1/users?search=john&search_fields=name,email
```

### 高级过滤
```http
GET /api/v1/users?created_at_from=2024-01-01&created_at_to=2024-12-31
```

## 文件上传

### 单文件上传
```http
POST /api/v1/users/avatar
Content-Type: multipart/form-data

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="avatar"; filename="avatar.jpg"
Content-Type: image/jpeg

<binary data>
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

### 多文件上传
```http
POST /api/v1/documents
Content-Type: multipart/form-data

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="files"; filename="document1.pdf"
Content-Type: application/pdf

<binary data>
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="files"; filename="document2.pdf"
Content-Type: application/pdf

<binary data>
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

## 数据验证

### 字段验证规则

#### 用户创建
```json
{
  "email": {
    "type": "string",
    "format": "email",
    "required": true,
    "maxLength": 255
  },
  "username": {
    "type": "string",
    "required": true,
    "minLength": 3,
    "maxLength": 50,
    "pattern": "^[a-zA-Z0-9_-]+$"
  },
  "password": {
    "type": "string",
    "required": true,
    "minLength": 8,
    "pattern": "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+$"
  }
}
```

### 自定义验证消息
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "验证失败",
    "details": [
      {
        "field": "email",
        "message": "请输入有效的邮箱地址",
        "value": "invalid-email"
      }
    ]
  }
}
```

## 速率限制

### 默认限制
- 认证端点: 5 次/分钟
- 普通端点: 100 次/分钟
- 文件上传: 10 次/分钟

### 响应头
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 缓存规范

### 缓存策略
- GET 请求: 缓存 5 分钟
- 静态资源: 缓存 1 小时
- 用户特定数据: 不缓存

### 缓存控制头
```http
Cache-Control: public, max-age=300
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Wed, 21 Oct 2015 07:28:00 GMT
```

## 健康检查

### 健康检查端点
```http
GET /health
```

### 响应示例
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "memory": "ok",
    "disk": "ok"
  },
  "version": "1.0.0"
}
```

## 错误处理

### 错误码规范

| 错误码 | 描述 | HTTP状态 |
|--------|------|----------|
| INVALID_INPUT | 输入参数无效 | 400 |
| UNAUTHORIZED | 未认证 | 401 |
| FORBIDDEN | 无权限 | 403 |
| NOT_FOUND | 资源不存在 | 404 |
| CONFLICT | 资源冲突 | 409 |
| RATE_LIMITED | 请求过于频繁 | 429 |
| INTERNAL_ERROR | 服务器内部错误 | 500 |

### 错误日志
所有错误都会被记录到日志系统，包含：
- 错误堆栈
- 请求信息
- 用户信息
- 时间戳

## 版本控制

### API 版本策略
- URL 版本控制: `/api/v1/`
- 向后兼容的修改不需要版本升级
- 破坏性修改需要新版本

### 版本弃用
- 提前 6 个月通知
- 提供迁移指南
- 维护旧版本 1 年

## 文档和示例

### OpenAPI 规范
- 使用 Swagger/OpenAPI 3.0
- 提供在线文档
- 包含请求/响应示例

### 代码示例
提供多种语言的 SDK 示例：
- JavaScript/Node.js
- Python
- Java
- Go
- PHP

## 监控和指标

### 关键指标
- 请求延迟 (P50, P95, P99)
- 错误率
- 吞吐量
- 资源使用率

### 告警规则
- 错误率 > 1%
- 响应时间 > 1s
- 内存使用率 > 80%
- 磁盘使用率 > 90%

## 安全最佳实践

### 数据保护
- 使用 HTTPS 加密传输
- 敏感数据加密存储
- 定期安全审计
- 输入数据清理

### 访问控制
- 最小权限原则
- 定期轮换密钥
- 多因素认证
- IP 白名单

## 性能优化

### 数据库优化
- 使用索引优化查询
- 避免 N+1 查询问题
- 使用连接池
- 读写分离

### API 优化
- 使用压缩
- 启用缓存
- 分页查询
- 字段选择

## 测试策略

### 测试类型
- 单元测试
- 集成测试
- 端到端测试
- 性能测试

### 测试覆盖率
- 代码覆盖率 > 80%
- API 覆盖率 100%
- 关键路径全覆盖

---

*最后更新: 2024年*
*API版本: v1.0.0*