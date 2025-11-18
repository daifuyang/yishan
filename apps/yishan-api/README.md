# Yishan API 项目

这是一个基于 Fastify 框架构建的高性能 Node.js API 服务，采用 TypeScript 开发，使用 Prisma ORM 进行数据库操作。

## 技术栈

- **框架**: Fastify 5.x
- **语言**: TypeScript 5.8.x (严格模式)
- **数据库**: MySQL + Prisma ORM
- **认证**: JWT (Fastify JWT)
- **缓存**: Redis
- **文档**: Swagger/OpenAPI
- **测试**: Node.js 内置测试框架
- **包管理**: pnpm

## 项目结构

```
├── src/
│   ├── routes/           # 路由层 (API 端点定义)
│   ├── services/         # 服务层 (业务逻辑处理)
│   ├── models/           # 模型层 (数据访问层)
│   ├── schemas/          # TypeBox Schema 定义 (请求/响应验证)
│   ├── constants/        # 常量定义 (错误码、业务码)
│   ├── utils/            # 工具类 (响应工具、数据库连接等)
│   ├── plugins/          # Fastify 插件配置
│   │   ├── external/     # 外部插件 (数据库、认证、Swagger等)
│   │   └── app/          # 应用插件
│   ├── controllers/      # 控制器层 (可选，复杂业务场景)
│   └── generated/        # 自动生成的代码 (Prisma Client)
├── prisma/               # Prisma 配置和迁移文件
├── docs/                 # 项目文档
└── test/                 # 测试文件
```

## 快速开始

### 环境要求

- Node.js 18.x 或更高版本
- MySQL 8.0+
- Redis 6.0+

### 安装依赖

```bash
pnpm install
```

### 环境配置

1. 创建 `.env` 文件：
```bash
cp .env.example .env
```

2. 配置数据库连接：
```env
DATABASE_URL="mysql://username:password@localhost:3306/yishan_api"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
```

### 数据库初始化

```bash
# 生成 Prisma 客户端
pnpm run db:generate

# 运行数据库迁移
pnpm run db:init

# 初始化数据
pnpm run db:seed
```

### fc函数部署

1. 安装 Serverless Framework：
```bash
npm install -g serverless
```

2. 配置 Serverless Framework：
```bash
s config add
```

3. 模拟线上环境
```bash
docker run --platform linux/amd64 -it --name yishan-api-serverless-dev  -v C:\Workspace\Frontend\yishan\apps\yishan-api\:/code registry.cn-beijing.aliyuncs.com/aliyunfc/runtime-custom.debian10:build-3.1.0 bash  
```

4. 执行部署脚本
```bash
./deploy/fc3/deploy.sh
```

3. 部署函数：
```bash
s deploy -y
```

## 可用脚本

```bash
# 开发模式 (带热重载)
pnpm run dev

# 生产模式
pnpm run start

# 运行测试
pnpm run test

# 构建 TypeScript
pnpm run build:ts

# 监听 TypeScript 变化
pnpm run watch:ts

# 数据库操作
pnpm run db:init      # 初始化数据库
pnpm run db:seed      # 填充测试数据
pnpm run db:reset     # 重置数据库
```

## 核心功能

### 用户管理系统
- 用户注册、登录、认证
- 用户信息管理 (CRUD)
- 用户权限控制
- JWT 令牌管理

### API 特性
- RESTful API 设计
- 统一的响应格式
- 完整的错误处理
- Swagger API 文档
- 请求参数验证
- 分页查询支持

### 数据库特性
- MySQL 关系型数据库
- Prisma ORM 类型安全
- 自动迁移管理
- 数据索引优化
- 软删除支持

## API 文档

启动服务后，访问 Swagger UI：
- 开发环境: http://localhost:3000/documentation

## 开发规范

详细的开发规范请参考项目文档：
- [API 规范文档](./docs/API规范文档.md)
- [业务码使用规范](./docs/业务码使用规范.md)

### 主要规范要点

1. **路由层**: RESTful 设计，使用 TypeBox Schema 验证
2. **服务层**: 业务逻辑处理，保持单一职责
3. **模型层**: 数据库操作，使用 Prisma ORM
4. **响应格式**: 统一使用 `ResponseUtil` 工具类
5. **错误处理**: 使用业务错误码，统一异常处理

## 部署

### 生产环境部署

1. 构建项目：
```bash
pnpm run build:ts
```

2. 启动服务：
```bash
pnpm run start
```

### Docker 部署

```bash
# 构建镜像
docker build -t yishan-api .

# 运行容器
docker run -p 3000:3000 --env-file .env yishan-api
```

## 贡献指南

1. 遵循项目编码规范
2. 编写相应的测试用例
3. 更新相关文档
4. 提交前运行测试确保通过

## 许可证

ISC License

## 技术支持

- Fastify 文档: https://fastify.dev/docs/latest/
- Prisma 文档: https://www.prisma.io/docs/
- TypeScript 文档: https://www.typescriptlang.org/docs/
