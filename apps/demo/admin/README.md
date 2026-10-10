# Demo Admin（@yishan/demo-admin）

Demo 产品管理后台，位于 `apps/demo/admin`。产品拥有 Umi 配置、运行时装配、API 客户端和业务页面；`@yishan/core-admin` 提供公共运行时与构建插件，`@yishan/core-system-admin` 提供系统管理贡献。两个 Core 包通过公开 exports 直接消费源码。

## 技术栈

- **框架**: React 19 + TypeScript
- **UI 组件库**: Ant Design 6.x
- **构建工具**: UmiJS 4.x + Max 插件
- **样式方案**: Less + Ant Design Style
- **代码规范**: Biome
- **包管理**: pnpm（monorepo workspace）

## 环境要求

- Node.js 22.22.1（遵循根 `.tool-versions`）
- pnpm 8.15.9（遵循根 `package.json#packageManager`）

## 快速开始

### 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 开发环境启动

```bash
# 默认连接同产品 Demo API（根目录命令）
pnpm dev:admin

# 启动开发服务器（不包含 mock 数据）
pnpm --filter @yishan/demo-admin start:no-mock

# 测试环境启动
pnpm --filter @yishan/demo-admin start:test

# 预发布环境启动
pnpm --filter @yishan/demo-admin start:pre
```

### 构建项目

```bash
# 根目录执行；自动先构建共享 TipTap
pnpm build:admin

# 构建并预览
pnpm --filter @yishan/demo-admin preview
```

## 开发脚本

以下短命令在 `apps/demo/admin` 执行。根目录可使用 `pnpm typecheck:admin` 检查产品与两个公共 Admin 包；测试前先运行 `pnpm --filter @yishan/demo-admin exec max setup`，新检出先构建 TipTap。

### 代码质量检查

```bash
# 代码规范检查
pnpm lint

# 单独检查 Biome 规则
pnpm biome:lint

# TypeScript 类型检查
pnpm typecheck
```

### 测试

```bash
# 运行测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:coverage

# 更新测试快照
pnpm test:update
```

### 其他脚本

```bash
# 代码分析
pnpm analyze

# 部署到 GitHub Pages
pnpm deploy

# 生成 API 文档
pnpm openapi
```

## 项目结构

```
src/
├── components/          # 公共组件
├── pages/              # 页面组件
├── modules/            # 产品业务模块页面与本地 UI
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

新页面分两类，处理方式不同：

- **框架页面**（登录、404、公开报价等）：由产品 `config/routes.ts` 显式声明。
- **系统管理页面**：通过 `@yishan/core-system-admin` 的公开页面贡献参与组件映射。
- **模块页面**（业务模块）：位于 `src/modules/<id>/pages/<page>/index.tsx`，构建插件仅纳入已安装模块。菜单组件键保持 `./modules/<id>/<page>`。详见 [module-pages.md](./docs/module-pages.md)

权限控制：模块页面对应权限码在 `[apps/demo/api] modules/<id>/permissions.ts` 集中注册。

### 添加 API 接口

1. 后端在 `apps/demo/api/src/modules/<id>/routes/v1/index.ts` 用 `createRouteRegistrar` 数组驱动注册
2. 先 dump 并审查同产品 `../api/openapi.json`，再运行 `pnpm --filter @yishan/demo-admin openapi`
3. 产品业务从 `@/services/generated/<module>` 导入；系统服务从 `@yishan/core-system-admin/services/<service>` 的公开 export 导入

详情见 [模块接入（后端与 Admin）](../../docs/content/modules/onboarding.md)。

### OpenAPI 生成所有权

包命令运行 `scripts/generate-openapi.cjs`，调用官方 `@umijs/openapi.generateService`，按当前安装清单与接口路径分区。

| 归属 | 生成目录 | 类型命名空间 |
|---|---|---|
| System 公共管理接口 | `packages/core/system-admin/src/services/generated/` | `SystemAPI` |
| 已安装产品模块 | `apps/demo/admin/src/services/generated/` | `API` |
| 未安装 CRM 的保留快照 | `apps/demo/admin/src/modules/crm/services/generated/` | `CrmAPI` |

输入来自当前产品 API 的 `openapi.json`。产品分区缓存位于 `node_modules/.cache/admin-openapi/product.json`，Umi OpenAPI 配置消费该分区，避免直接 `max openapi` 重复生成 System 客户端。完整重新生成使用包命令，生成服务与对应 typings 一起提交。保留 CRM 快照不注册未安装模块页面。

### 本地多实例端口

`config/proxy.ts` 调用公共 `resolveApiTarget`，Demo 默认 API 地址为 `http://localhost:3100`。覆盖优先级为 `API_TARGET` → `YISHAN_API_TARGET` → `YISHAN_API_PORT` → 产品默认。`ADMIN_PORT` 控制产品启动时的 Umi dev-server 端口；为另一 API 实例设置对应完整代理 URL 或端口。构建的 `/admin/` base 与 API 的 `ADMIN_BASE_PATH` 仍需一致。

### 自定义主题

修改 `config/defaultSettings.ts` 中的主题配置，或通过 `config/config.ts` 中的 `antd` 配置进行主题定制。

### 路由 base 与登录重定向注意事项

项目在 `config/config.ts` 中配置了 `base/publicPath`（默认 `/admin/`），路由跳转与 `redirect` 处理需要遵循以下规则：

1. **不要手动重复拼接 base**
   - 使用 `history.push('/user/login')`，不要写 `history.push('/admin/user/login')`
   - 否则在有 base 的情况下会出现 `/admin/admin/user/login`

2. **登录页判断要先去掉 base**
   - 实际路径通常是 `/admin/user/login`
   - 业务判断应基于去掉 base 之后的路径（如 `/user/login`）

3. **redirect 必须做安全归一化**
   - 如果 `redirect` 指向登录页本身（`/user/login`），应回退到 `/`
   - 避免在登录页刷新后出现 `redirect` 套 `redirect` 的递归嵌套

4. **拼接 redirect 时优先使用当前相对路由语义**
   - 保证登录成功后回跳到原始业务页面
   - 同时避免把完整登录页 URL 再次编码写回 `redirect`

## 项目文档

- [模块页面注册机制](./docs/module-pages.md) — 公开构建插件、安装清单与菜单组件映射
- [表单模式（DrawerForm + FormEditor）](./docs/form-pattern.md) — CRUD 页面骨架与字段约定

## 部署

构建时 `PUBLIC_PATH` 必须与 API 的 `ADMIN_BASE_PATH` 一致，线上沿用 `/admin/`。从根目录以 `PUBLIC_PATH=/admin/` 运行 `pnpm build:admin`（PowerShell：`$env:PUBLIC_PATH='/admin/'`），通过 `node scripts/package-api.mjs --output <external-temp-directory> --admin apps/demo/admin/dist` 打包到 API 静态目录。

正式 FC3 发布由人工触发的 fullstack workflow 完成，部署入口与环境要求见 [Demo API 部署说明](../api/deploy/fc3/README.md)。构建和打包不发布生产、不执行数据库迁移。

## 许可证

MIT License
