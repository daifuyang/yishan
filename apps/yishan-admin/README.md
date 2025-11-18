# Yishan Admin

基于 Ant Design Pro 构建的企业级中后台管理系统前端项目。

## 技术栈

- **框架**: React 19 + TypeScript
- **UI 组件库**: Ant Design 5.x
- **构建工具**: UmiJS 4.x + Max 插件
- **样式方案**: Less + Ant Design Style
- **代码规范**: Biome
- **包管理**: npm

## 环境要求

- Node.js >= 20.0.0
- npm >= 8.0.0

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发环境启动

```bash
# 启动开发服务器（包含 mock 数据）
npm start

# 启动开发服务器（不包含 mock 数据）
npm run start:no-mock

# 测试环境启动
npm run start:test

# 预发布环境启动
npm run start:pre
```

### 构建项目

```bash
# 生产环境构建
npm run build

# 构建并预览
npm run preview
```

## 开发脚本

### 代码质量检查

```bash
# 代码规范检查
npm run lint

# 自动修复代码规范问题
npm run biome:lint

# TypeScript 类型检查
npm run tsc
```

### 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 更新测试快照
npm run test:update
```

### 其他脚本

```bash
# 代码分析
npm run analyze

# 部署到 GitHub Pages
npm run deploy

# 生成 API 文档
npm run openapi
```

## 项目结构

```
src/
├── components/          # 公共组件
├── pages/              # 页面组件
├── services/           # API 服务
├── utils/              # 工具函数
├── locales/            # 国际化资源
├── hooks/              # 自定义 Hooks
└── types/              # TypeScript 类型定义

config/
├── config.ts           # 主配置文件
├── routes.ts           # 路由配置
├── defaultSettings.ts   # 默认设置
└── proxy.ts            # 代理配置
```

## 特性

- ✅ **TypeScript**: 完整的类型支持
- ✅ **国际化**: 多语言支持
- ✅ **权限管理**: 基于角色的访问控制
- ✅ **Mock 数据**: 开发环境数据模拟
- ✅ **代码规范**: 统一的代码风格
- ✅ **Git Hooks**: 提交前自动检查
- ✅ **响应式设计**: 移动端适配

## 开发指南

### 添加新页面

1. 在 `src/pages` 目录下创建页面组件
2. 在 `config/routes.ts` 中配置路由
3. 如需权限控制，在 `src/access.ts` 中配置权限

### 添加 API 接口

1. 在 `src/services` 目录下创建服务文件
2. 使用 `@umijs/max` 提供的 request 方法
3. 配置 OpenAPI 文档自动生成类型

### 自定义主题

修改 `config/defaultSettings.ts` 中的主题配置，或通过 `config/config.ts` 中的 `antd` 配置进行主题定制。

## 部署

项目支持多种部署方式，具体配置请参考 `deploy/` 目录下的部署脚本。

### 函数计算（FC3）部署

项目支持部署到阿里云函数计算（FC3），部署脚本位于 `deploy/fc3/deploy.sh`。

**重要：部署脚本必须在项目根目录执行**

```bash
# 在项目根目录执行部署脚本
./deploy/fc3/deploy.sh
```

部署脚本执行以下步骤：

1. **安装依赖**：使用 pnpm 安装项目依赖
2. **构建项目**：执行生产环境构建
3. **配置 Nginx**：复制 Nginx 配置文件到构建目录
4. **部署配置**：复制 s.yaml 部署配置文件到根目录
5. **部署到 FC3**：使用 s 命令部署到函数计算
6. **清理**：删除临时部署配置文件

**前置条件**：
- 已安装并配置阿里云函数计算 CLI 工具（s 命令）
- 已配置阿里云访问凭证
- 确保在项目根目录执行脚本

**注意事项**：
- 部署脚本会自动处理依赖安装和构建过程
- 部署完成后会自动清理临时文件
- 确保有足够的权限执行部署操作

## 许可证

MIT License
