# 依山 API 开发规范文档

## 项目概述

依山 API 是一个基于 Fastify 构建的 Node.js RESTful API 服务，采用 TypeScript 开发，遵循分层架构和领域驱动设计原则。

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Fastify 5.x
- **语言**: TypeScript 5.x
- **数据库**: MySQL + Redis (缓存)
- **ORM**: Knex.js
- **测试**: Node.js 内置测试框架 + c8 覆盖率
- **构建**: TypeScript 编译器

## 项目结构规范

### 目录结构

```
src/
├── app.ts              # 应用入口和配置
├── server.ts           # 服务器启动文件
├── domain/             # 领域模型 (核心实体和DTO)
│   └── *.ts
├── services/           # 业务逻辑层
│   └── *Service.ts
├── repository/         # 数据访问层
│   └── *Repository.ts
├── routes/             # HTTP路由定义
│   ├── *.ts
│   └── README.md
├── plugins/            # Fastify插件
│   ├── external/       # 外部插件配置
│   └── app/            # 应用插件
└── *.ts

test/                   # 测试文件
├── *.test.ts
└── helper.ts

migrations/             # 数据库迁移文件
├── *.do.sql
└── *.undo.sql

scripts/                # 开发脚本
├── create-database.ts
├── migrate.ts
└── seed.ts
```

### 分层架构原则

1. **领域层 (Domain)**
   - 定义核心业务实体和DTO
   - 不包含任何框架或基础设施依赖
   - 纯 TypeScript 接口和类型定义

2. **服务层 (Services)**
   - 处理业务逻辑
   - 协调多个 Repository 的操作
   - 事务边界在此层定义

3. **数据访问层 (Repository)**
   - 封装所有数据库操作
   - 处理缓存逻辑
   - 不包含业务逻辑

4. **路由层 (Routes)**
   - 仅处理HTTP请求和响应
   - 调用相应的服务层方法
   - 处理错误和状态码

## 编码规范

### 命名规范

- **文件和目录**: 使用 kebab-case
- **类和接口**: 使用 PascalCase
- **变量和函数**: 使用 camelCase
- **常量**: 使用 UPPER_SNAKE_CASE
- **数据库字段**: 使用 snake_case

### TypeScript 规范

- 所有代码必须使用 TypeScript
- 严格模式开启 (`strict: true`)
- 禁止使用 `any` 类型
- 使用接口定义所有数据结构
- 异步函数必须返回 `Promise<T>`

### 代码风格

- 使用单引号
- 分号必须
- 2个空格缩进
- 最大行长: 100字符
- 使用 async/await 而不是回调

### 错误处理规范

```typescript
// 服务层错误
throw new Error('具体错误消息')

// 路由层统一错误处理
fastify.setErrorHandler((err, request, reply) => {
  fastify.log.error({ err, request: { method, url } }, 'Unhandled error occurred')
  reply.code(err.statusCode ?? 500)
  return { message: err.statusCode < 500 ? err.message : 'Internal Server Error' }
})
```

## API 设计规范

### RESTful 设计原则

- 使用标准HTTP方法 (GET, POST, PUT, DELETE)
- 使用语义化的URL路径
- 使用正确的HTTP状态码
- 统一的响应格式

### URL 规范

```
GET    /api/v1/users          # 获取用户列表
GET    /api/v1/users/:id      # 获取单个用户
POST   /api/v1/users          # 创建用户
PUT    /api/v1/users/:id      # 更新用户
DELETE /api/v1/users/:id      # 删除用户
```

### 响应格式

#### 成功响应
```json
{
  "message": "操作成功描述",
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

#### 错误响应
```json
{
  "error": "错误类型",
  "message": "用户友好的错误消息",
  "details": { ... }
}
```

### 状态码使用

- `200 OK` - 成功获取资源
- `201 Created` - 成功创建资源
- `204 No Content` - 成功删除资源
- `400 Bad Request` - 请求参数错误
- `401 Unauthorized` - 未认证
- `403 Forbidden` - 无权限
- `404 Not Found` - 资源不存在
- `409 Conflict` - 资源冲突
- `500 Internal Server Error` - 服务器错误

## 数据库规范

### 迁移文件命名

- `001.do.users.sql` - 创建用户表
- `001.undo.users.sql` - 回滚用户表
- `002.do.tasks.sql` - 创建任务表

### 表设计规范

- 所有表必须有 `id` 主键
- 使用 `created_at` 和 `updated_at` 时间戳
- 使用 snake_case 命名字段
- 添加必要的索引
- 外键约束必须命名

### 缓存规范

- 使用 Redis 作为缓存
- 缓存键使用前缀模式: `resource:operation:id`
- 设置合理的TTL时间
- 实现缓存失效策略

## 测试规范

### 测试结构

```
test/
├── routes/           # 路由测试
├── services/         # 服务测试
├── repository/       # 数据访问测试
└── helper.ts         # 测试辅助工具
```

### 测试命名

- 测试文件: `*.test.ts`
- 测试描述: 使用 should...when... 格式
- 测试分组: 使用 describe 分组

### 测试覆盖率

- 目标覆盖率: 80%+
- 必须测试: 核心业务逻辑、数据访问层、API端点
- 使用 c8 进行覆盖率报告

## 开发工作流

### 本地开发

1. **环境准备**
   ```bash
   # 安装依赖
   pnpm install
   
   # 复制环境变量
   cp .env.example .env
   
   # 配置数据库连接
   # 编辑 .env 文件
   ```

2. **数据库设置**
   ```bash
   # 创建数据库
   pnpm run db:create
   
   # 运行迁移
   pnpm run db:migrate
   
   # 填充测试数据
   pnpm run db:seed
   ```

3. **启动开发服务器**
   ```bash
   # 开发模式 (热重载)
   pnpm run dev
   
   # 生产模式
   pnpm start
   ```

### 代码提交流程

1. **功能开发**
   - 创建功能分支: `git checkout -b feature/user-management`
   - 遵循提交消息规范
   - 添加相应的测试

2. **代码检查**
   ```bash
   # 运行测试
   pnpm test
   
   # 检查TypeScript
   pnpm run build:ts
   
   # 检查代码格式
   pnpm run lint
   ```

3. **提交消息规范**
   - `feat: 添加用户管理功能`
   - `fix: 修复用户创建时的验证问题`
   - `docs: 更新API文档`
   - `test: 添加用户服务测试`

## 部署规范

### 环境变量

```bash
# 数据库配置
DATABASE_URL=mysql://user:password@localhost:3306/yishan

# Redis配置
REDIS_URL=redis://localhost:6379

# 应用配置
PORT=3000
NODE_ENV=production

# 缓存配置
CACHE_TTL=3600
```

### 健康检查

- 提供 `/health` 健康检查端点
- 检查数据库连接状态
- 检查Redis连接状态
- 返回系统状态信息

### 监控和日志

- 使用 Fastify 内置日志系统
- 结构化日志格式 (JSON)
- 记录请求和响应时间
- 错误日志包含上下文信息

## 安全规范

### 认证和授权

- 使用 JWT token 进行认证
- 实现基于角色的访问控制 (RBAC)
- 密码使用 bcrypt 加密
- 实现速率限制

### 输入验证

- 所有输入参数必须验证
- 使用 JSON Schema 验证请求体
- 防止SQL注入
- 防止XSS攻击

### 敏感信息

- 不在日志中记录密码等敏感信息
- 不在错误消息中暴露系统细节
- 使用环境变量管理配置

## 性能优化

### 数据库优化

- 添加适当的索引
- 使用连接池
- 实现查询优化
- 使用缓存减少数据库查询

### API优化

- 实现分页查询
- 使用压缩中间件
- 实现响应缓存
- 使用CDN加速静态资源

## 最佳实践

### 代码组织

- 保持单一职责原则
- 使用依赖注入
- 实现接口隔离
- 遵循开闭原则

### 错误处理

- 使用 try-catch 处理异步错误
- 提供有意义的错误消息
- 记录详细的错误日志
- 实现优雅降级

### 文档维护

- 保持API文档同步更新
- 使用Swagger/OpenAPI规范
- 提供代码示例
- 定期更新开发指南

## 参考资源

- [Fastify 官方文档](https://fastify.dev/docs/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Knex.js 查询构建器](https://knexjs.org/)
- [Node.js 最佳实践](https://github.com/goldbergyoni/nodebestpractices)

---

*最后更新: 2024年*
*维护团队: 依山开发团队*