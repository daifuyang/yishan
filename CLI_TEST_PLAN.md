# Yishan API CLI 测试计划

## 测试范围

- `auth`：登录/登出/刷新/当前用户
- `resources`：资源发现
- `gen from-openapi`：资源自动生成
- `api` 通用调用：CRUD、校验、模板、上传
- 插件资源：`portal.*` / `hello.*`
- 容错与边界：未登录、参数缺失、坏 JSON、无效资源/动作

## 前置条件

- API 服务已启动：`http://127.0.0.1:3000`
- 测试账号可用：`admin/admin123`
- 有可上传测试文件（如 `/etc/hosts` 或 `./test.png`）
- 已构建：`pnpm --filter yishan-api build:ts`

## 测试用例

### 1) 认证主流程

- `auth login` 成功，检查 `~/.yishan-cli/session.json` 写入 token/baseUrl
- `auth me` 返回当前用户
- `auth refresh` 成功并更新 token
- `auth logout` 清理本地会话，再执行 `auth me` 应提示先登录

### 2) 资源发现与生成

- `resources` 能列出核心资源与插件资源
- 执行 `gen from-openapi` 成功，检查 `apps/yishan-api/src/cli/generated-resources.ts` 更新
- 重新执行 `resources`，确认动作集合完整（`list/create/detail/update/delete`）

### 3) 通用 API（查询类）

- `api users list --page 1 --page-size 10` 成功且有分页信息
- `api users detail --id <existingId>` 成功
- `api users detail --id 99999999` 返回业务错误（资源不存在）

### 4) 通用 API（写操作 + 校验）

- `api users create --help-input` 输出字段清单
- `api users create --template` 输出最小模板
- `api users create --template-full` 输出完整模板
- `api users create --data '{"username":"u1"}'` 本地拦截必填缺失
- `api users create --data '{"username":"u1"}' --no-validate` 跳过本地校验并交由后端处理

### 5) 文件上传（multipart）

- `api attachments create --file <path> --kind other --name test` 上传成功
- 上传后 `api attachments list --page 1 --page-size 5` 能看到新记录
- 非法用法：`api users create --file <path>`（非 multipart 接口）应给出清晰错误

### 6) 插件资源回归

- `api portal.articles list --page 1 --page-size 10`
- `api portal.pages list --page 1 --page-size 10`
- `api hello.me list`（或该资源支持动作）验证插件自动发现与路由可达

### 7) 异常与鲁棒性

- 未登录直接调用 `api ...`，应提示先登录
- `--data` 传坏 JSON，应报“必须是合法 JSON”
- 不存在资源：`api foo.bar list`，应报资源不存在
- 不支持动作：`api users xxx`，应报动作不支持

## 验收标准

- 主链路全部可执行且错误提示明确
- 上传可成功落库并可查询
- OpenAPI 生成后资源可即时被 CLI 使用
- 校验/模板/帮助信息与 OpenAPI 一致

## 备注

- 推荐按顺序执行，以减少环境变量和会话状态干扰。
- 若使用 tmux 启动 API，可通过 `tmux capture-pane -t yishan-api-dev -p -S -120` 查看日志。
