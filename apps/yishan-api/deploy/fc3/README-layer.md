# FC3 Layered 部署方案

本目录维护当前唯一的 FC3 layered 部署链路。函数代码与运行时依赖分层发布，仓库不再保留其他 FC 部署方案。

## 分层边界

- Layer: 稳定运行时依赖，例如 Fastify、`@fastify/*`、TypeBox、dayjs、qiniu、dotenv、`@prisma/client` runtime、`@prisma/adapter-mariadb` 和 MariaDB driver。
- 函数代码包: 编译后的业务代码、插件模块、Prisma generated 代码、Admin 静态资源。
- 函数本地依赖: 默认为空；函数包不携带 `node_modules`。
- 运行时配置: 本地部署时可从 `.env` 加载变量给 `s deploy` 使用；线上函数包不携带 `.env`，运行时配置由 `s-function-layered.yaml` 注入 FC 环境变量。

依赖清单在 `layer-dependencies.json` 中维护。Layer 是否需要重新发布由指纹判断：`runtime + layer dependencies + package.json 中对应版本` 共同生成 fingerprint；业务代码、Admin 静态资源、Prisma schema 不影响该指纹。

## 本地构建验证

```bash
cd apps/yishan-api
./deploy/fc3/build-runtime-layer.sh
./deploy/fc3/pre-deploy-layered.sh
```

如果 Admin 静态资源有改动，需要先在仓库根目录按 `/admin/` 二级目录构建并同步到 API：

```bash
pnpm --filter yishan-tiptap build
pnpm build:admin:fc
```

不要直接使用默认 `pnpm --filter yishan-admin build` 产物部署到 FC；默认 `PUBLIC_PATH=/` 会让 `index.html` 引用 `/umi.*.js`、`/umi.*.css`，在 `https://example.zerocmf.com/admin` 下会出现静态资源 404。FC 一体化部署要求 Admin 产物引用 `/admin/...`。

构建结果：

- Layer 目录：`deploy/fc3/.build/runtime-layer`
- Layer 压缩包：`deploy/fc3/runtime-layer.zip`
- 函数代码包目录：`deploy/fc3/.build/function-code`

查看当前 Layer 指纹：

```bash
node deploy/fc3/layer-state.cjs fingerprint package.json deploy/fc3/layer-dependencies.json
```

## 部署 Layered 函数

只有当当前指纹与 `deploy/fc3/layer-lock.json` 不一致时，才需要发布新的 FC Layer 版本。把 `runtime-layer.zip` 或 `deploy/fc3/.build/runtime-layer` 发布为 FC Layer，拿到版本 ARN 后记录：

```bash
cd apps/yishan-api
node deploy/fc3/layer-state.cjs record \
  package.json \
  deploy/fc3/layer-dependencies.json \
  deploy/fc3/layer-lock.json \
  'acs:fc:cn-shanghai:<account-id>:layers/<layer-name>/versions/<version>'
```

之后部署函数不需要再手动传 ARN，脚本会校验 `layer-lock.json` 的指纹并读取 ARN：

```bash
./deploy/fc3/deploy-layered-function.sh
```

当前函数名默认是 `yishan-demo-layered`。

如果临时要覆盖 lock 中的 ARN，可显式设置：

```bash
export YISHAN_API_RUNTIME_LAYER_ARN='acs:fc:cn-shanghai:<account-id>:layers/<layer-name>/versions/<version>'
./deploy/fc3/deploy-layered-function.sh
```

## 测试记录：2026-07-07

本次验证目标是把函数包做到 zero-local `node_modules`，公共依赖全部放入 Runtime Layer。

### 已发布测试 Layer

- Layer 名称：`yishan-api-runtime-layer-test`
- Region：`cn-shanghai`
- Compatible runtime：`custom.debian12`
- Version：`1`
- ARN：`acs:fc:cn-shanghai:1650595695532785:layers/yishan-api-runtime-layer-test/versions/1`
- Fingerprint：`sha256:1d8dbe86bf0a4c9ed424103e897a9bfd95d27807d0d0d9ff7b0fe9131c76bba7`

发布命令：

```bash
cd apps/yishan-api

s cli fc3 layer publish \
  --region cn-shanghai \
  --layer-name yishan-api-runtime-layer-test \
  --code ./deploy/fc3/.build/runtime-layer \
  --compatible-runtime custom.debian12 \
  --description "Yishan API runtime layer test sha256:1d8dbe86bf0a4c9ed424103e897a9bfd95d27807d0d0d9ff7b0fe9131c76bba7" \
  -a enterprise \
  --output-format json
```

发布后记录本地 lock：

```bash
node deploy/fc3/layer-state.cjs record \
  package.json \
  deploy/fc3/layer-dependencies.json \
  deploy/fc3/layer-lock.json \
  'acs:fc:cn-shanghai:1650595695532785:layers/yishan-api-runtime-layer-test/versions/1'
```

`layer-lock.json` 是本地状态文件，不提交到 git。

## 部署 Layered 域名与证书

域名部署脚本：

```bash
cd apps/yishan-api

export FC_FUNCTION_NAME='yishan-demo-layered'
export FC_CUSTOM_DOMAIN='example.zerocmf.com'
export FC_CERT_NAME="example-zerocmf-com-$(date +%Y%m%d)"

./deploy/fc3/deploy-layered-domain.sh
```

默认模板为 `deploy/fc3/s-domain-layered.yaml`，证书文件从 `deploy/fc3/certs/fullchain.cer` 与 `deploy/fc3/certs/private.key` 读取，适用于本地和 CI 共用。

### 已部署 Layered 函数

- Function 名称：`yishan-demo-layered`
- Runtime：`custom.debian12`
- Layer：`acs:fc:cn-shanghai:1650595695532785:layers/yishan-api-runtime-layer-test/versions/1`
- VPC：`vpc-uf65806lcuh5b43szs1db`
- vSwitch：`vsw-uf6fcm08qor78wfioz1c2`
- Security Group：`sg-uf6bl327dijrauls3ism`
- Database Host：`172.23.212.135`（ECS 私网 IP，仅 FC 运行时使用）
- Redis Host：`172.23.212.135`（ECS 私网 IP，仅 FC 运行时使用）
- HTTP URL：`https://yishan-layered-ewzhyfnszv.cn-shanghai.fcapp.run`
- Custom Domain：`https://example.zerocmf.com`

部署命令：

```bash
cd apps/yishan-api

set -a
. ./.env
set +a

./deploy/fc3/pre-deploy-layered.sh
./deploy/fc3/deploy-layered-function.sh
```

验证结果：

```bash
curl -i https://yishan-layered-ewzhyfnszv.cn-shanghai.fcapp.run/api/v1/app
curl -i https://example.zerocmf.com/api/v1/app
```

返回 `200 OK`，响应体包含：

```json
{
  "success": true,
  "code": 10000,
  "message": "yishan app channel ready"
}
```

### 包体结果

本次构建结果：

- Runtime Layer 目录：约 `201M`
- Runtime Layer 上传后 CodeSize：约 `48.23 MB`
- 函数代码包目录：约 `29M`
- 函数代码包不包含 `node_modules`
- 函数代码包不包含 `.env`

这里的 `201M` 和 `48.23 MB` 是不同口径：`201M` 是本地 `deploy/fc3/.build/runtime-layer` 展开目录大小；`48.23 MB` 是 FC 保存的 Layer 代码包大小，接近压缩后的上传大小。Node 依赖里有大量 JS、JSON、类型声明和 metadata，压缩率较高，所以两者差异是正常现象。

检查命令：

```bash
du -sh deploy/fc3/.build/runtime-layer deploy/fc3/.build/function-code
test -d deploy/fc3/.build/function-code/node_modules && echo function_has_node_modules || echo function_no_node_modules
test -f deploy/fc3/.build/function-code/.env && echo function_has_env || echo function_no_env
```

### Redis 配置

FC 测试函数必须使用公网可达 Redis，不能使用本地 `localhost`。

本次使用集中凭证：

```bash
~/.config/env-config/redis.yaml
```

已验证公网 Redis：

- Host：`139.196.89.64`
- Port：`6379`
- DB：`0`
- Password：从 `env-config` 读取，不写入文档和 git

本地验证 Redis：

```bash
cd apps/yishan-api

node - <<'NODE'
const fs = require('fs')
const path = `${process.env.HOME}/.config/env-config/redis.yaml`
const text = fs.readFileSync(path, 'utf8')
const kv = {}
for (const line of text.split(/\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.*?)\s*$/)
  if (m && !m[1].startsWith('#')) kv[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const Redis = require('ioredis')
const redis = new Redis({
  host: kv.host,
  port: Number(kv.port || 6379),
  password: kv.password,
  db: Number(kv.db || 0),
  connectTimeout: 5000,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
})
;(async () => {
  try {
    await redis.connect()
    console.log(await redis.ping())
  } finally {
    redis.disconnect()
  }
})().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
NODE
```

### 注意事项

1. `pino-pretty` 是开发日志工具，不应该进入 Runtime Layer。`server.ts` 中只有显式设置 `PINO_PRETTY=1` 且当前进程是 TTY 时才启用 pretty logger；FC 线上默认走普通 logger。
2. `deploy-layered-function.sh` 会生成临时 `.s-layered.yaml` 并在退出时清理，不依赖仓库中的根级部署模板文件。
3. `s cli fc3 layer publish --code` 可以直接传目录；本机没有 `zip` 时，`build-runtime-layer.sh` 会跳过压缩，但仍可发布 `deploy/fc3/.build/runtime-layer`。
4. `.env` 不进入 layered 函数包。部署命令可以在本地 `set -a; . ./.env; set +a`，但这只是给 `s deploy` 提供变量；线上运行只看 FC 环境变量。
5. `NODE_PATH` 必须包含 `/opt/nodejs/node_modules`，函数代码运行时依赖从 Layer 解析。
6. 如果 FC 上曾经部署过临时环境变量，后续模板不再包含这些变量时，需确认 FC 是否保留旧值；本次最终代码和模板中不依赖 `REDIS_ENABLED`、`DATABASE_AUTO_CONNECT` 这类测试开关。
7. `example.zerocmf.com` 应通过 `deploy/fc3/s-domain-layered.yaml` 或 `deploy/fc3/deploy-layered-domain.sh` 绑定到 `yishan-demo-layered`。
8. Admin 静态资源必须使用 `PUBLIC_PATH=/admin/` 构建。验证方式：`curl https://example.zerocmf.com/admin` 返回的 HTML 中 CSS/JS 应该以 `/admin/` 开头。
9. Layered 测试函数已接入 ECS 所在 VPC，线上 `DATABASE_HOST` 与 `REDIS_HOST` 固定为 ECS 私网 IP `172.23.212.135`。本地 `.env` 可以继续使用公网地址，避免本地开发环境无法访问私网。
