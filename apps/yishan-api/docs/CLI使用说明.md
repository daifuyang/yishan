# API CLI 使用说明

## 1. 构建

```bash
pnpm --filter yishan-api build:ts
```

## 2. 运行

```bash
pnpm --filter yishan-api cli -- --help
```

也可以直接运行：

```bash
node apps/yishan-api/dist/cli/index.js --help
```

## 3. 常用命令

```bash
# 登录（保存 token 到 ~/.yishan-cli/session.json）
pnpm --filter yishan-api cli -- auth login -u admin -p 123456

# 查看当前用户
pnpm --filter yishan-api cli -- auth me

# 刷新 token
pnpm --filter yishan-api cli -- auth refresh

# 退出登录（清理本地会话）
pnpm --filter yishan-api cli -- auth logout

# 用户列表
pnpm --filter yishan-api cli -- users list --page 1 --page-size 10 --keyword admin

# 查看已注册资源（含自动扫描的插件资源）
pnpm --filter yishan-api cli -- resources

# 通用调用方式（无需每个业务手写命令）
pnpm --filter yishan-api cli -- api users list --page 1 --page-size 10
pnpm --filter yishan-api cli -- api users detail --id 1
pnpm --filter yishan-api cli -- api users create --data '{"username":"u1","password":"123456","roleId":1}'

# 上传文件（multipart/form-data）
pnpm --filter yishan-api cli -- api attachments create --file ./test.png --folder-id 1 --kind image --name test-image

# 关闭 OpenAPI 输入校验（默认开启）
pnpm --filter yishan-api cli -- api users create --data '{"username":"u1"}' --no-validate

# 查看接口输入字段（来自 OpenAPI）
pnpm --filter yishan-api cli -- api users create --help-input

# 生成 body 必填模板
pnpm --filter yishan-api cli -- api users create --template

# 生成 body 完整模板（含可选字段）
pnpm --filter yishan-api cli -- api users create --template-full

# 从 OpenAPI 自动生成资源映射
pnpm --filter yishan-api cli -- gen from-openapi --base-url http://127.0.0.1:3000
```

## 4. API 地址

- 默认地址：`http://127.0.0.1:3000`
- 可用环境变量：`YISHAN_API_BASE_URL`
- 或登录时通过参数指定：`--base-url <url>`

示例：

```bash
pnpm --filter yishan-api cli -- auth login -u admin -p 123456 --base-url http://127.0.0.1:3000
```

## 5. 自动化策略

- 核心模块资源采用配置注册，不再逐个手写命令逻辑。
- 支持从 OpenAPI 自动生成资源映射（输出到 `src/cli/generated-resources.ts`）。
- `api` 通用命令默认按 OpenAPI 校验输入必填字段（query/body）。
- 支持 `--help-input` 查看字段清单，支持 `--template` 输出必填 body 骨架。
- 支持 `--template-full` 输出包含可选字段的完整 body 草稿。
- `api` 命令传 `--file <path>` 时会以 multipart/form-data 上传文件（适用于附件上传接口）。
- 插件资源会自动扫描 `src/plugins/modules/*/routes/v1/admin/*` 目录，生成 `<plugin>.<resource>` 资源名。
- 扫描到的插件资源可直接通过通用命令调用：

```bash
pnpm --filter yishan-api cli -- resources
pnpm --filter yishan-api cli -- api portal.articles list --page 1 --page-size 10
```
