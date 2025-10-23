# 移山项目开发规范与要求

## 项目概述

移山项目是一个基于Fastify框架构建的现代化Node.js后端服务，采用模块化单体架构（Modular Monolith），为未来可能的微服务拆分做好准备。

## 技术栈

### 核心框架
- **Fastify**: 高性能Web框架
- **TypeScript**: 类型安全的JavaScript超集
- **Knex.js**: SQL查询构建器
- **Redis**: 缓存和会话存储

### 开发工具
- **Node.js**: 18+
- **pnpm**: 包管理器（推荐）
- **c8**: 代码覆盖率工具
- **concurrently**: 并行运行工具

### 数据库
- **MySQL**: 主数据库
- **迁移管理**: 使用Knex迁移文件

## 项目结构规范

### 目录结构

```
yishan-api/
├── src/                    # 源代码目录
│   ├── plugins/           # 插件目录
│   │   ├── external/      # 外部插件（安全、CORS等）
│   │   └── app/          # 应用插件（业务逻辑）
│   ├── routes/           # 路由定义
│   │   ├── api/          # API路由
│   │   └── example/      # 示例路由
│   ├── services/         # 业务逻辑层
│   ├── repository/       # 数据访问层
│   ├── domain/           # 领域模型
│   ├── constants/        # 常量定义
│   ├── utils/           # 工具函数
│   └── types/           # 类型定义
├── migrations/           # 数据库迁移文件
├── test/               # 测试文件
├── docs/              # 项目文档
└── scripts/           # 脚本文件
```

### 分层架构

#### 1. 表示层（Routes）
- 负责处理HTTP请求和响应
- 只包含路由定义和简单的请求验证
- 不直接处理业务逻辑

#### 2. 业务逻辑层（Services）
- 处理核心业务逻辑
- 协调多个repository的操作
- 实现事务管理

#### 3. 数据访问层（Repository）
- 封装数据库操作
- 实现缓存策略
- 处理数据持久化

#### 4. 领域模型层（Domain）
- 定义核心业务实体
- 包含DTO（数据传输对象）
- 定义接口和类型

## 编码规范

### 命名规范

#### 文件命名
- 使用小写字母和连字符（kebab-case）
- 示例：`user-repository.ts`, `response-util.ts`

#### 类命名
- 使用PascalCase
- 示例：`UserService`, `ProductRepository`

#### 函数和变量命名
- 使用camelCase
- 示例：`getUserById`, `createProduct`

#### 常量命名
- 使用UPPER_SNAKE_CASE
- 示例：`CACHE_TTL`, `MAX_PAGE_SIZE`

### 代码风格

#### TypeScript配置
```json
{
  "extends": "fastify-tsconfig",
  "compilerOptions": {
    "outDir": "dist",
    "sourceMap": true,
    "typeRoots": ["node_modules/@types", "src/types"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

#### 导入规范
- 使用ES6模块语法
- 按顺序分组导入：
  1. Node.js内置模块
  2. 第三方模块
  3. 本地模块

```typescript
// 正确示例
import path from 'node:path'
import fastify from 'fastify'
import { UserService } from '../services/user-service'
```

### 错误处理

#### 业务码规范
- 使用5位数字格式
- 按模块分类：
  - 1xxxx: 系统模块
  - 2xxxx: 用户模块
  - 3xxxx: 订单模块
  - 4xxxx: 商品模块
  - 5xxxx: 支付模块

#### 响应格式
```typescript
interface BaseResponse {
  code: number      // 业务码
  message: string  // 响应消息
  timestamp: number // 时间戳
  requestId: string // 请求ID
}

interface SuccessResponse<T> extends BaseResponse {
  data: T          // 响应数据
}

interface ErrorResponse extends BaseResponse {
  error: {
    type: string   // 错误类型
    description: string // 错误描述
    stack?: string // 堆栈信息（开发环境）
  }
}
```

## 数据库规范

### 迁移文件命名
- 使用序号和描述性名称
- 格式：`{序号}.{操作}.{表名}.sql`
- 示例：`001.do.users.sql`, `001.undo.users.sql`

### 迁移文件组织规范
- **主表与关联表合并原则**：相关联的主表和关联表应合并到同一个迁移文件中
- **文件组织方式**：
  - `003.do.roles.sql` - 包含 `sys_role` 表和 `sys_user_role` 关联表的创建
  - `008.do.departments.sql` - 包含 `sys_department` 表和相关关联表的创建
- **回滚文件对应**：回滚文件应包含所有相关表的删除操作，按依赖关系逆序执行
- **避免过度拆分**：不要将紧密关联的表拆分到不同的迁移文件中

### 表结构规范
- 使用小写蛇形命名：`user_profiles`, `order_items`
- 必须包含时间戳字段：`created_at`, `updated_at`
- 主键统一命名为`id`
- 外键使用`{表名}_id`格式

### SQL规范
```sql
-- 正确示例
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## API设计规范

### RESTful API设计
- 使用HTTP动词表示操作：
  - GET: 查询资源
  - POST: 创建资源
  - PUT: 更新整个资源
  - PATCH: 更新部分资源
  - DELETE: 删除资源

### URL规范
```
GET    /api/v1/users          # 获取用户列表
GET    /api/v1/users/:id     # 获取单个用户
POST   /api/v1/users         # 创建用户
PUT    /api/v1/users/:id     # 更新用户
DELETE /api/v1/users/:id     # 删除用户
```

### 分页查询规范

#### 请求参数
- `page`: 页码，从1开始，默认1
- `pageSize`: 每页数量，范围1-100，默认10
- `search`: 搜索关键词（可选）
- `sortBy`: 排序字段（可选）
- `sortOrder`: 排序方向 asc|desc（可选）

#### 响应格式
```typescript
interface PaginationResponse<T> {
  code: number
  message: string
  data: {
    items: T[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
  }
}
```

#### 状态码规范
- **20060**: 分页查询成功
- **40060**: 分页参数错误
- **50060**: 分页查询失败

#### 示例
```typescript
// 请求
GET /api/v1/users?page=1&pageSize=10&search=张三&sortBy=created_at&sortOrder=desc

// 响应
{
  "code": 20060,
  "message": "获取用户列表成功",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

### 分页查询规范

#### 请求参数
```typescript
interface PaginationQuery {
  page?: number;      // 页码，默认1，最小1
  pageSize?: number;  // 每页条数，默认10，最小1，最大100
  sortBy?: string;    // 排序字段，默认id
  sortOrder?: 'asc' | 'desc'; // 排序方向，默认desc
  search?: string;    // 搜索关键词，可选
}
```

#### 响应格式
```typescript
interface PaginationResponse<T> {
  code: number;           // 业务状态码 (20060: 分页查询成功)
  message: string;        // 响应消息
  data: {
    list: T[];            // 数据列表
    pagination: {
      page: number;       // 当前页码
      pageSize: number;   // 每页条数
      total: number;      // 总记录数
      totalPages: number; // 总页数
    }
  }
}
```

#### 状态码规范
分页查询统一使用系统的业务状态码规范：
- **成功响应**: 10000 (SUCCESS_CODE) - 操作成功
- **参数错误**: 40010 (INVALID_PARAMETER) - 参数无效
- **服务器错误**: 50000 (INTERNAL_ERROR) - 内部服务器错误

参数验证错误详情将在 `error.validation` 字段中返回。

#### 客户端判断逻辑
- **是否有下一页**: `page < totalPages`
- **是否有上一页**: `page > 1`
- **是否为空结果**: `total === 0`
- **是否为最后一页**: `page === totalPages`

#### 实现示例
```typescript
// 路由定义
schema: {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      pageSize: { type: 'number', minimum: 1, maximum: 100, default: 10 },
      sortBy: { type: 'string', enum: ['id', 'created_at', 'updated_at'], default: 'id' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
      search: { type: 'string' }
    }
  }
}

// 服务层处理
const page = Math.max(1, query.page || 1)
const pageSize = Math.max(1, Math.min(100, query.pageSize || 10))
const offset = (page - 1) * pageSize

// 查询总数
const total = await repository.count(filter)
const totalPages = Math.max(0, Math.ceil(total / pageSize))

// 查询数据
const list = await repository.find({
  limit: pageSize,
  offset,
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
  search: query.search
})

return {
  list,
  pagination: {
    page,
    pageSize,
    total,
    totalPages
  }
}
```

### 请求/响应格式
#### 请求格式
```json
{
  "email": "user@example.com",
  "username": "example",
  "password": "securepassword"
}
```

#### 响应格式
```json
{
  "code": 10000,
  "message": "操作成功",
  "timestamp": 1640995200000,
  "requestId": "uuid-12345",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "username": "example",
    "created_at": "2022-01-01T00:00:00Z"
  }
}
```

## 缓存规范

### Redis键命名规范
- 使用冒号分隔的命名空间
- 格式：`{模块}:{功能}:{标识}`
- 示例：`users:user:123`, `products:list:{query}`

### 缓存策略
- 读取时：先查缓存，缓存未命中再查数据库
- 写入时：更新数据库后清除相关缓存
- 缓存失效：使用合理的TTL值

```typescript
// 缓存键常量
const CACHE_PREFIX = 'users:'
const CACHE_TTL = 3600 // 1小时

// 缓存操作示例
const cacheKey = `${CACHE_PREFIX}user:${id}`
const cachedUser = await this.getCache<User>(cacheKey)
if (cachedUser) return cachedUser

const user = await this.knex('users').where({ id }).first()
if (user) {
  await this.setCache(cacheKey, user, CACHE_TTL)
}
```

## 测试规范

### 测试结构
- 单元测试：测试单个函数或类
- 集成测试：测试API端点
- 端到端测试：测试完整流程

### 测试文件命名
- 测试文件使用`.test.ts`后缀
- 与被测试文件同名
- 示例：`user-service.test.ts`

### 测试工具
- 使用Node.js内置测试框架
- 使用`fastify-cli/helper.js`进行集成测试

```typescript
// 测试示例
import { test } from 'node:test'
import { build } from '../helper.js'

test('GET /api/users', async (t) => {
  const app = await build(t)
  
  const response = await app.inject({
    method: 'GET',
    url: '/api/users'
  })
  
  t.assert.strictEqual(response.statusCode, 200)
})
```

## 安全规范

### 密码安全
- 使用bcrypt进行密码哈希
- 密码最小长度：8位
- 包含大小写字母、数字和特殊字符

### 输入验证
- 使用Joi或类似库进行输入验证
- 防止SQL注入：使用参数化查询
- 防止XSS攻击：对用户输入进行转义

### 认证授权
- 使用JWT进行身份认证
- 实现基于角色的访问控制（RBAC）
- 敏感操作需要二次验证

## 性能规范

### 响应时间
- API响应时间：< 200ms
- 数据库查询：< 100ms
- 缓存命中：< 10ms

### 分页规范
- 默认页大小：20
- 最大页大小：100
- 使用游标分页避免深度分页问题

### 资源限制
- 请求体大小：10MB
- 文件上传：使用分片上传
- 并发连接：使用连接池

## 日志规范

### 日志级别
- ERROR: 系统错误
- WARN: 警告信息
- INFO: 一般信息
- DEBUG: 调试信息

### 日志格式
```json
{
  "timestamp": "2022-01-01T00:00:00Z",
  "level": "INFO",
  "message": "用户登录成功",
  "context": {
    "userId": 123,
    "email": "user@example.com"
  }
}
```

## 部署规范

### 环境变量
```bash
# 数据库配置
DATABASE_URL=mysql://user:password@localhost:3306/yishan
REDIS_URL=redis://localhost:6379

# 应用配置
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# 安全配置
JWT_SECRET=your-secret-key
BCRYPT_ROUNDS=12
```

### 健康检查
- 提供`/health`端点
- 检查数据库连接
- 检查Redis连接
- 返回系统状态

### 监控指标
- API响应时间
- 错误率
- 数据库连接数
- 缓存命中率

## 开发工作流

### 分支策略
- main: 生产环境分支
- develop: 开发环境分支
- feature/*: 功能开发分支
- hotfix/*: 紧急修复分支

### 代码审查
- 所有代码必须经过代码审查
- 使用Pull Request进行合并
- 确保测试覆盖率>80%

### 发布流程
1. 功能开发完成
2. 编写/更新测试
3. 代码审查
4. 合并到develop分支
5. 集成测试
6. 合并到main分支
7. 部署到生产环境

## 文档规范

### API文档
- 使用Swagger/OpenAPI 3.0
- 提供在线文档：http://localhost:3000/docs
- 包含请求/响应示例

### 代码注释
- 使用JSDoc格式
- 复杂业务逻辑需要详细注释
- 公共API必须包含使用示例

```typescript
/**
 * 创建新用户
 * @param data - 用户创建数据
 * @returns 创建的用户对象
 * @throws 当邮箱已存在时抛出错误
 * @example
 * ```typescript
 * const user = await userService.createUser({
 *   email: 'user@example.com',
 *   username: 'example',
 *   password: 'securepassword'
 * })
 * ```
 */
async createUser(data: CreateUserDTO): Promise<User> {
  // 实现代码
}
```

## 最佳实践

### 代码复用
- 使用装饰器模式扩展功能
- 创建可复用的工具函数
- 避免重复代码

### 错误处理
- 使用try-catch处理异步操作
- 提供有意义的错误消息
- 记录错误日志

### 性能优化
- 使用数据库索引
- 合理使用缓存
- 避免N+1查询问题
- 使用批量操作

### 安全性
- 定期更新依赖包
- 使用HTTPS协议
- 实施速率限制
- 定期安全审计

## 参考资源

- [Fastify官方文档](https://fastify.dev/docs/latest/)
- [TypeScript官方文档](https://www.typescriptlang.org/docs/)
- [Knex.js官方文档](https://knexjs.org/)
- [Node.js测试文档](https://nodejs.org/api/test.html)
- [RESTful API设计指南](https://restfulapi.net/)

---

*本文档会随项目发展持续更新，如有疑问请联系项目维护者。*