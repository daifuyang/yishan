# Demo App H5 — 阿里云 FC 部署

线上地址：<https://h5.zerocmf.com>

| 资源 | 值 |
|---|---|
| FC 函数 | `yishan-h5`（cn-shanghai，custom.debian12，0.35 vCPU / 512 MB） |
| 自定义域名 | `h5.zerocmf.com`：`/api/*` → `yishan-demo-layered`（现有 API 函数），`/*` → `yishan-h5` |
| DNS | `h5 CNAME 1650595695532785.cn-shanghai.fc.aliyuncs.com` |
| 证书 | Let's Encrypt，ACME DNS-01（阿里云 DNS），90 天有效 |

H5 走同源 `/api`，由域名路由直接转给 API 函数，所以构建时不注入 `YISHAN_APP_API_BASE_URL`，API 也不需要开放 CORS。
`server.mjs` 是零依赖静态服务器：hash 路由，未知路径回到 `index.html`；Taro 产物文件名不带内容哈希，所以统一 `no-cache` + ETag 协商（未变返回 304）。

## 手动部署

```bash
# 1. 构建 H5 并组装函数代码 → deploy/fc3/.build/function-code/{server.mjs,public/}
bash apps/demo/app/deploy/fc3/scripts/pre-deploy.sh

# 2. 只更新函数（日常发版）
bash apps/demo/app/deploy/fc3/scripts/deploy.sh

# 3. 首次部署或换证书时，连同自定义域名一起更新（需要 certs/fullchain.cer 与 certs/private.key）
bash apps/demo/app/deploy/fc3/scripts/deploy.sh --domain
```

`s` 使用 `default` 凭证（`s config get` 查看）。模板变量都有默认值，可用环境变量覆盖：
`FUNCTION_REGION`、`H5_FUNCTION_NAME`、`API_FUNCTION_NAME`、`H5_DOMAIN`、`H5_CERT_NAME`。

## 证书签发 / 续期

Windows 上 `aic cert:issue` 依赖本机 bash 版 acme.sh，不可用；用官方 Docker 镜像执行同样的 DNS-01 流程，
ACME 状态保存在仓库外的 `~/.yishan-acme`，阿里云 DNS 凭证只在执行期间写入临时 env 文件：

```bash
# ali.env 内容：Ali_Key=<AccessKeyId> / Ali_Secret=<AccessKeySecret>（与 aic 的 aliyun profile 相同），用完即删
MSYS_NO_PATHCONV=1 docker run --rm --env-file ~/.yishan-acme/ali.env \
  -v "C:/Users/<you>/.yishan-acme:/acme.sh" neilpang/acme.sh \
  --issue --dns dns_ali -d h5.zerocmf.com --keylength 2048 --server letsencrypt   # 续期用 --renew -d h5.zerocmf.com

mkdir -p apps/demo/app/deploy/fc3/certs
cp ~/.yishan-acme/h5.zerocmf.com/fullchain.cer apps/demo/app/deploy/fc3/certs/fullchain.cer
cp ~/.yishan-acme/h5.zerocmf.com/h5.zerocmf.com.key apps/demo/app/deploy/fc3/certs/private.key
bash apps/demo/app/deploy/fc3/scripts/deploy.sh --domain
```

`.build/` 与 `certs/` 已在 `apps/demo/app/.gitignore` 中忽略，证书与私钥绝不提交。
