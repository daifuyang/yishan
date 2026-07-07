# FC3 公共 Layer 测试方案

本目录新增一条并行的 layered 部署路径，用于验证公共依赖从函数代码包中拆出后是否可行。原有 `pre-deploy.sh` 与 `s-function.yaml` 不变。

## 分层边界

- Layer: 稳定运行时依赖，例如 Fastify、`@fastify/*`、TypeBox、dayjs、qiniu、dotenv、`@prisma/client` runtime。
- 函数代码包: 编译后的业务代码、插件模块、Prisma generated 代码、Admin 静态资源。
- 函数本地依赖: 默认只保留 `@prisma/adapter-mariadb` 及其 MariaDB driver 依赖。

依赖清单在 `layer-dependencies.json` 中维护。Layer 是否需要重新发布由指纹判断：`runtime + layer dependencies + package.json 中对应版本` 共同生成 fingerprint；业务代码、Admin 静态资源、Prisma schema 不影响该指纹。

## 本地构建验证

```bash
cd apps/yishan-api
./deploy/fc3/build-runtime-layer.sh
./deploy/fc3/pre-deploy-layered.sh
```

构建结果：

- Layer 目录：`deploy/fc3/.build/runtime-layer`
- Layer 压缩包：`deploy/fc3/runtime-layer.zip`
- 函数代码包目录：`deploy/fc3/.build/function-code`

查看当前 Layer 指纹：

```bash
node deploy/fc3/layer-state.cjs fingerprint package.json deploy/fc3/layer-dependencies.json
```

## 部署测试函数

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

测试函数名默认是 `yishan-demo-layered`，避免覆盖当前 `yishan-demo`。

如果临时要覆盖 lock 中的 ARN，可显式设置：

```bash
export YISHAN_API_RUNTIME_LAYER_ARN='acs:fc:cn-shanghai:<account-id>:layers/<layer-name>/versions/<version>'
./deploy/fc3/deploy-layered-function.sh
```
