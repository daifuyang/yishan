# 依山 API 开发文档

欢迎来到依山 API 开发文档！本文档包含了完整的开发规范、最佳实践和技术指南。

## 📚 文档目录

### 🚀 快速开始
- [开发规范指南](./development-guidelines.md) - 项目架构、编码规范、开发流程
- [API 接口规范](./api-guidelines.md) - RESTful API 设计、请求响应格式、状态码
- [响应规范指南](./response-guidelines.md) - 统一响应格式、业务错误码、分页规范

### 🗄️ 数据层
- [数据库设计规范](./database-guidelines.md) - 数据库设计、迁移规范、性能优化

### 🧪 测试
- [测试规范指南](./testing-guidelines.md) - 测试策略、单元测试、集成测试、端到端测试

## 🎯 核心特性

- **🚀 高性能**: 基于 Fastify 框架，提供极致性能
- **🔒 安全可靠**: JWT 认证、权限控制、数据加密
- **📊 可扩展**: 分层架构、插件化设计、微服务就绪
- **🧪 全面测试**: 单元测试、集成测试、端到端测试
- **📈 监控完善**: 健康检查、性能监控、日志追踪

## 🏗️ 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **运行时** | Node.js 18+ | JavaScript 运行时 |
| **框架** | Fastify 5.x | Web 框架 |
| **语言** | TypeScript 5.x | 类型安全 |
| **数据库** | MySQL 8.0+ | 主数据库 |
| **缓存** | Redis 6.0+ | 缓存层 |
| **ORM** | Knex.js | 数据库查询构建器 |
| **测试** | Node.js 内置测试框架 | 单元测试 |
| **覆盖率** | c8 | 代码覆盖率 |

## 📁 项目结构

```
yishan-api/
├── 📁 src/                    # 源代码
│   ├── 📁 app.ts             # 应用入口
│   ├── 📁 domain/            # 领域模型
│   ├── 📁 services/          # 业务逻辑层
│   ├── 📁 repository/        # 数据访问层
│   ├── 📁 routes/            # HTTP路由
│   └── 📁 plugins/           # Fastify插件
├── 📁 test/                  # 测试文件
├── 📁 migrations/            # 数据库迁移
├── 📁 scripts/              # 开发脚本
├── 📁 docs/                 # 📍 你在这里！
├── 📄 package.json          # 项目配置
└── 📄 tsconfig.json         # TypeScript配置
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd yishan-api

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
```

### 2. 数据库设置

```bash
# 创建数据库
npm run db:create

# 运行迁移
npm run db:migrate

# 填充测试数据
npm run db:seed
```

### 3. 启动开发服务器

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

### 4. 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 查看测试覆盖率
npm run test:coverage
```

## 📋 开发工作流

### 1. 功能开发
```bash
# 创建功能分支
git checkout -b feature/user-authentication

# 开发功能
# ... 编写代码 ...

# 运行测试
npm test

# 提交代码
git add .
git commit -m "feat: add user authentication"
```

### 2. 代码审查
- 所有代码必须经过审查
- 测试覆盖率必须达到 75%+
- 遵循项目编码规范

### 3. 部署流程
- 自动部署到测试环境
- 手动部署到生产环境
- 回滚策略准备就绪

## 🔧 开发工具

### 推荐 IDE 设置
- **VS Code** + 以下扩展：
  - TypeScript
  - ESLint
  - Prettier
  - GitLens
  - Thunder Client (API测试)

### 调试配置
```bash
# 使用 VS Code 调试
# 按 F5 启动调试
# 设置断点进行调试
```

## 📊 API 文档

当开发服务器运行时，可以访问：
- **Swagger UI**: http://localhost:3000/docs
- **OpenAPI JSON**: http://localhost:3000/docs/json

## 🆘 常见问题

### Q: 如何解决数据库连接问题？
A: 检查 `.env` 文件中的数据库配置是否正确。

### Q: 如何处理测试数据库？
A: 使用专门的测试数据库，确保测试隔离。

### Q: 如何调试性能问题？
A: 使用内置的日志系统和性能监控工具。

## 🤝 贡献指南

1. **Fork** 项目
2. **创建** 功能分支 (`git checkout -b feature/AmazingFeature`)
3. **提交** 变更 (`git commit -m 'Add some AmazingFeature'`)
4. **推送** 到分支 (`git push origin feature/AmazingFeature`)
5. **创建** Pull Request

## 📞 联系方式

- **项目负责人**: [项目负责人邮箱]
- **技术支持**: [技术支持邮箱]
- **文档维护**: [文档维护邮箱]

## 📄 许可证

本项目采用 [ISC 许可证](../LICENSE)

## 🔄 更新日志

查看 [CHANGELOG.md](../CHANGELOG.md) 了解详细的更新历史。

---

**💡 提示**: 开始开发前，建议先阅读 [开发规范指南](./development-guidelines.md) 了解项目架构和最佳实践！

*最后更新: 2024年*
*维护团队: 依山开发团队*