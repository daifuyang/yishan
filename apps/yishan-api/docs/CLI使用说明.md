# API CLI 使用说明

Yishan API 的命令行客户端已统一为 [Restish](https://rest.sh/)。Restish 是一个通用 OpenAPI CLI，会直接从服务暴露的 OpenAPI 文档生成命令，因此无需为每个业务接口手写 CLI 子命令，OpenAPI 文档更新后命令即同步刷新。

> 历史版本曾经基于 `pnpm --filter yishan-api cli` 提供一个内部 CLI，已废弃，请使用本文档描述的 Restish 方式。

## 1. 安装 Restish

```bash
# macOS
brew install restish

# Linux（下载 Release 二进制）
curl -fsSL https://rest.sh/install.sh | sh

# 或从源码
go install github.com/danielgtaylor/restish/cmd/restish@latest

# 验证
restish --version   # 当前已验证 2.3.0 可用
```

## 2. 注册 Yishan API

只需执行一次，将 `yishan` 这个名字绑定到本地服务并指向它的 OpenAPI 文档：

```bash
restish api connect yishan http://127.0.0.1:3000 \
  --spec http://127.0.0.1:3000/api/docs/json \
  --replace --yes
```

成功后即可看到命令总数：

```bash
restish yishan    # 列出全部 173+ 个生成的命令
```

### 切换环境

不同环境只需分别注册即可，例如：

```bash
restish api connect yishan-staging https://staging-api.example.com \
  --spec https://staging-api.example.com/api/docs/json --yes
restish api connect yishan-prod https://api.example.com \
  --spec https://api.example.com/api/docs/json --yes
```

之后使用 `restish yishan-staging ...` / `restish yishan-prod ...` 切换。

## 3. 配置鉴权

Yishan API 兼容两种鉴权方式：

- **JWT 访问令牌**：登录后获得的 `access_token`（短时）
- **API Token（PAT，推荐）**：`yishan_pat_` 开头的长效令牌，可在「管理后台 → 个人中心 → API 令牌」创建

### 3.1 推荐：API Token（PAT）

创建一次 PAT 后存到环境变量：

```bash
export YISHAN_PAT="yishan_pat_xxxxxxxxxxxxxxxxxxxxxxxx"
```

然后让 Restish 把该环境变量作为 bearer token 注入到请求头。把下面的 JSON 合并到 Restish 配置（默认路径 `~/.config/restish/restish.json`）：

```json
{
  "apis": {
    "yishan": {
      "base_url": "http://127.0.0.1:3000",
      "spec_url": "http://127.0.0.1:3000/api/docs/json",
      "profiles": {
        "default": {
          "headers": ["Accept: application/json"],
          "credentials": {
            "bearerAuth": {
              "auth": {
                "type": "bearer",
                "params": { "token": "env:YISHAN_PAT" }
              }
            }
          }
        }
      }
    }
  }
}
```

> 也可以一行搞定：`restish api auth add yishan bearerAuth`（按提示输入 token）。
> Restish 会自动把 token 写入 `~/.config/restish/restish.json`。
>
> 注意 `auth.type` 必须是 `bearer`（不是 `http-bearer-token`），否则会报 `unknown auth type`。

### 3.2 临时：JWT

先用 `restish yishan login` 拿到 access token，然后通过 `--rsh-header` 临时覆盖：

```bash
# 登录获取 token
restish yishan login --username admin --password 'admin123'

# 或者直接传 token
restish yishan get-current-user --rsh-header "Authorization: Bearer <JWT>"
```

> JWT 有效期较短（默认 24h），刷新需要重新登录。日常调试/脚本场景请优先使用 PAT。

## 4. 常用命令

列出全部命令：

```bash
restish yishan
```

按名称过滤（支持子串）：

```bash
restish yishan 2>&1 | grep -i article
```

### 4.1 认证相关

```bash
# 当前用户信息
restish yishan get-current-user

# 登录 / 登出 / 刷新
restish yishan login --username admin --password 'admin123'
restish yishan logout
restish yishan refresh-token --refreshToken <token>
```

### 4.2 业务资源（CRUD）

Restish 会把每个 operation 翻译成 `<method>-<path>` 形式的命令（部分路径生成时使用完整 URL，命名形如 `post-api-v1-admin-xxx-yyy`）。

```bash
# 用户列表
restish yishan list-sys-user --page 1 --pageSize 10 --keyword admin

# 用户详情
restish yishan get-sys-user-detail --id 1

# 创建用户
restish yishan create-sys-user \
  --username u1 --password 'Pass@123' --realName '测试' \
  --email u1@example.com --phone '13800000000' --status 1

# 状态变更
restish yishan update-sys-user-status --id 1 --status 0

# 重置密码
restish yishan reset-sys-user-password --id 1 --newPassword 'Pass@123'

# 删除
restish yishan delete-sys-user --id 1
```

### 4.3 我的 API Token

```bash
# 创建（明文仅返回一次）
restish yishan me-create-api-token --name "test-cli"

# 列表
restish yishan me-list-api-tokens

# 详情
restish yishan me-get-api-token --id 1

# 撤销
restish yishan me-revoke-api-token --id 1
```

### 4.4 插件模块（portal / shop / hello）

插件路由也会被 OpenAPI 自动收录，命令名按 operationId 生成：

```bash
# 文章列表
restish yishan list-article --page 1 --pageSize 10

# 创建文章
restish yishan create-article \
  --title 'Hello' --content '...' --categoryId 1 --templateId 1

# 商品 SKU 列表
restish yishan get-api-modules-shop-v1-admin-skus --page 1 --pageSize 20

# 订单发货
restish yishan put-api-modules-shop-v1-admin-orders-id-deliver --id 1 \
  --trackingNo 'SF1234567890' --carrier '顺丰'
```

### 4.5 输出与过滤

```bash
# 输出格式：auto/json/yaml/table/lines/gron/ndjson/toon/cbor
restish yishan list-sys-user -o table --rsh-columns id,username,realName,status

# jq 风格过滤
restish yishan list-sys-user -o json -f 'data.list[] | {id, username}'

# 只取 code 与 message
restish yishan get-current-user -o lines -f 'code,message'

# 关闭分页拉取（只取首页）
restish yishan list-sys-user --rsh-no-paginate
```

### 4.6 调试

```bash
# -v 看请求/响应头
restish yishan get-current-user -v

# -vv 看 TLS 细节
restish yishan get-current-user -vv

# 跳过缓存
restish yishan get-current-user --rsh-no-cache

# 看 operation 输入字段
restish yishan create-sys-user --help
```

## 5. 直接 HTTP 调用（无需注册）

偶发的临时 URL 调用无需注册 API：

```bash
restish get   http://127.0.0.1:3000/api/v1/system/info \
  --rsh-header "Authorization: Bearer $YISHAN_PAT"

restish post  http://127.0.0.1:3000/api/v1/auth/login \
  --data '{"username":"admin","password":"admin123"}'
```

## 6. API 地址

- 默认本地地址：`http://127.0.0.1:3000`
- OpenAPI 规范：`http://127.0.0.1:3000/api/docs/json`（生成命令的依据）
- Swagger UI：`http://127.0.0.1:3000/api/docs`（浏览器可视化）

可通过 `restish api edit yishan` 或直接编辑 `~/.config/restish/restish.json` 修改 `base_url` / `spec_url` 切换到其他环境。

## 7. 常见问题

| 问题 | 解决 |
| --- | --- |
| `unknown API "yishan"` | 重新执行 `restish api connect yishan ...` |
| `missing required auth setup value` | `export YISHAN_PAT=...` 后重试，或执行 `restish api auth add yishan bearerAuth` |
| `unknown auth type "http-bearer-token"` | 配置 JSON 里应使用 `"type": "bearer"`（不是 `http-bearer-token`） |
| 命令找不到 | OpenAPI 已更新，重新 `restish api connect yishan ... --replace --yes` 即可 |
| 中文乱码 | 设置终端编码为 UTF-8（`LANG=en_US.UTF-8` 或 `zh_CN.UTF-8`） |

## 8. 迁移对照表

下表列出原 `pnpm --filter yishan-api cli ...` 命令到 Restish 命令的等价映射，便于老用户切换。

| 原 pnpm cli 命令 | Restish 等价命令 |
| --- | --- |
| `pnpm cli -- auth login -u admin -p xxx` | `restish yishan login --username admin --password xxx` |
| `pnpm cli -- auth me` | `restish yishan get-current-user` |
| `pnpm cli -- auth refresh` | `restish yishan refresh-token --refreshToken <token>` |
| `pnpm cli -- auth logout` | `restish yishan logout` |
| `pnpm cli -- users list --page 1 --page-size 10 --keyword admin` | `restish yishan list-sys-user --page 1 --pageSize 10 --keyword admin` |
| `pnpm cli -- users detail --id 1` | `restish yishan get-sys-user-detail --id 1` |
| `pnpm cli -- users create --data '{...}'` | `restish yishan create-sys-user --username u1 --password xxx ...` |
| `pnpm cli -- api attachments create --file ./a.png --folder-id 1` | `restish yishan upload-attachments --file ./a.png --folderId 1` |
| `pnpm cli -- resources` | `restish yishan`（列出全部命令） |
| `pnpm cli -- gen from-openapi --base-url http://127.0.0.1:3000` | `restish api connect yishan http://127.0.0.1:3000 --spec http://127.0.0.1:3000/api/docs/json --replace` |

## 9. 参考

- Restish 官网与文档：<https://rest.sh/>
- 项目 OpenAPI 规范：`http://127.0.0.1:3000/api/docs/json`
- 项目 Swagger UI：`http://127.0.0.1:3000/api/docs`