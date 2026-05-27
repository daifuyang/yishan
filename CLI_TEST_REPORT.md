# CLI 测试报告

**测试时间**: 2026-05-27
**测试环境**: http://127.0.0.1:3000
**测试账号**: admin/admin123

---

## 测试结果

### 1) 认证主流程

| 用例 | 结果 | 说明 |
|------|------|------|
| `auth login` 成功 | ✅ 通过 | 登录成功，session.json 正确写入 |
| `auth me` 返回当前用户 | ✅ 通过 | 返回完整用户信息 |
| `auth refresh` 成功 | ✅ 通过 | 令牌刷新成功 |
| `auth logout` 清理会话 | ✅ 通过 | 清理后 `auth me` 正确提示先登录 |

### 2) 资源发现与生成

| 用例 | 结果 | 说明 |
|------|------|------|
| `resources` 列出资源 | ✅ 通过 | 显示 10 个资源（含插件资源） |
| `gen from-openapi` 生成资源 | ✅ 通过 | 生成 6 个资源，输出到 generated-resources.ts |
| 生成后资源可正常使用 | ✅ 通过 | users/roles/departments 等 CRUD 正常 |

### 3) 通用 API（查询类）

| 用例 | 结果 | 说明 |
|------|------|------|
| `api users list --page 1 --page-size 10` | ✅ 通过 | 分页信息完整 |
| `api users detail --id <existingId>` | ✅ 通过 | 返回完整用户详情 |
| `api users detail --id 99999999` | ✅ 通过 | 返回业务错误"用户不存在或已删除" |

### 4) 通用 API（写操作 + 校验）

| 用例 | 结果 | 说明 |
|------|------|------|
| `api users create --help-input` | ✅ 通过 | 正确输出字段清单 |
| `api users create --template` | ✅ 通过 | 输出最小模板 |
| `api users create --template-full` | ✅ 通过 | 输出完整模板 |
| `api users create --data '{"username":"u1"}'` | ✅ 通过 | 本地拦截必填缺失 |
| `api users create --data '...' --no-validate` | ✅ 通过 | 跳过校验交后端处理 |

### 5) 文件上传（multipart）

| 用例 | 结果 | 说明 |
|------|------|------|
| `api attachments create --file /etc/hosts` | ✅ 通过 | 上传成功，返回文件信息 |
| 上传后 `api attachments list` 查到记录 | ✅ 通过 | 新记录可查询 |
| `--file` 用于非 multipart 接口 | ✅ 通过 | 给出本地校验错误 |

### 6) 插件资源回归

| 用例 | 结果 | 说明 |
|------|------|------|
| `api portal.articles list` | ✅ 通过 | 返回文章列表，分页正常 |
| `api portal.pages list` | ✅ 通过 | 返回页面列表 |
| `api hello.me list` | ✅ 通过 | 返回 hello 模块信息 |

### 7) 异常与鲁棒性

| 用例 | 结果 | 说明 |
|------|------|------|
| 未登录直接调用 `api ...` | ✅ 通过 | 提示"请先登录" |
| `--data` 传坏 JSON | ✅ 通过 | 报错"--data 必须是合法 JSON 字符串" |
| 不存在资源 `api foo.bar list` | ✅ 通过 | 报错"资源不存在: foo.bar" |
| 不支持动作 `api users xxx` | ✅ 通过 | 报错"资源 users 不支持动作 xxx" |

---

## Bug 修复

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 1 | `types.ts:29` | LoginResponseData 定义 `accessToken`，但 API 返回 `token` | 改为 `token` |
| 2 | `index.ts:78` | login 处理读取 `result.data.accessToken` | 改为 `result.data.token` |

---

## 验收标准达成情况

- ✅ 主链路全部可执行且错误提示明确
- ✅ 上传可成功落库并可查询
- ✅ OpenAPI 生成后资源可即时被 CLI 使用
- ✅ 校验/模板/帮助信息与 OpenAPI 一致
- ✅ 插件资源(portal.*/hello.*)全部正常

**所有测试用例全部通过**

---

## 备注

- 推荐按顺序执行测试，以减少环境变量和会话状态干扰
- 若使用 tmux 启动 API，可通过 `tmux capture-pane -t yishan-api-dev -p -S -120` 查看日志
- 插件资源测试已完成，所有插件资源(portal.articles/portal.pages/hello.me)均正常
