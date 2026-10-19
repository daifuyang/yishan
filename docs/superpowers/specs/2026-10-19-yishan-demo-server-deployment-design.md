# yishan 演示环境单机部署设计（阿里云 FC → 腾讯云 Ubuntu）

日期：2026-10-19
状态：待评审

## 1. 意图与动机

yishan 演示环境目前部署在阿里云函数计算（FC3）上。为了节省成本，**演示环境改为部署到一台已有的腾讯云 Ubuntu 服务器（43.143.122.225）**，以单进程 + nginx 的常规形态提供服务。

**范围限定**：本设计只针对演示环境。真实业务部署路径不变，仍走 FC。

## 2. 目标 / 非目标 / 反目标

### 目标
- 演示环境在腾讯云单机上稳定运行 admin（前端）、API（后端）、H5（小程序 Web）。
- 演示环境不再消耗 FC 费用。
- 新增一条以 rsync + systemd 为核心的 CD 路径，替换 FC 的 `s deploy`。
- 部署过程可回滚：保留上一版产物目录，切换失败可切回。

### 非目标
- 不改动任何应用业务代码。已核实产物形态与平台无关。
- 不迁移数据库。数据层继续留在阿里云 ECS。
- 不改动真实业务的 FC 部署能力（workflow 文件保留，只是不再由演示环境触发）。

### 反目标（做到即视为失败）
- 不得为了省事把数据库口令、JWT_SECRET、私钥写进仓库或 workflow 明文。
- 不得让 MySQL/Redis 对 `0.0.0.0/0` 开放。
- 不得覆盖或影响该服务器上已在运行的 4 个 nginx 站点和 3 个 Docker 容器。

## 3. 已核实的现状（事实，非假设）

### 3.1 目标服务器：腾讯云 43.143.122.225（Ubuntu 24.04.4）
- 规格：4 核 / 3.6G 内存 / 40G 根分区（已用 56%）。**可用内存约 2.4G，偏紧**。
- 内网地址 `10.0.0.2`，公网 `43.143.122.225`。内网地址 `172.17.0.1`（docker0）等。
- **已占用端口（不可复用）**：
  - `3306` MySQL 容器（库：`appdb`、`yishan_crm_local`）——**与演示环境无关**
  - `5433` Postgres 容器（库：`yishan_mp`）——与演示环境无关
  - `6379` Redis 容器——与演示环境无关
  - `80` / `443` nginx
  - `7890` / `7892` / `7893` / `9999` / `1053` `CrashCore` 服务
- **空闲端口**：`3000`、`3001`、`9000`（已核实）。
- nginx 1.24.0，`sites-enabled` 已有 4 个站点：`agent.zerocmf.com`、`codecloud.tech`、`dsh.zerocmf.com`、`yugongsoft.com`。
- 证书约定：`/etc/nginx/certs/<域名>.fullchain.crt` + `.key`；acme.sh 位于 `/home/ubuntu/.acme.sh`，**http-01** 方式，webroot 为 `/var/www/acme-challenge`。现有 4 套证书最近于 2026-10-19 19:23 续期，说明该流程在正常运行。
- Docker 存在但**本方案不使用**（理由见 §6.1）。

### 3.1.1 Node 运行时（**不符合要求，需安装**）
- 现有 Node 为 **v24.19.0**，位于 `~/.nvm/versions/node/v24.19.0/bin/node`（nvm 用户级安装）。
- `.tool-versions` 固定 **22.22.1**，`apps/demo/api/package.json` 声明 `engines.node >=22`。
- **两个问题**：① 版本不匹配（24 ≠ 22.22.1）；② nvm 是用户级路径，**systemd 以 root 运行时无法解析**，且 nvm 升级 Node 后路径会变，导致 `ExecStart` 失效。
- **处理**：安装系统级 Node 22.22.1 到固定路径（如 `/usr/local/lib/nodejs/node-v22.22.1-linux-x64`），`ExecStart` 指向其绝对路径。**不使用 nvm**。

### 3.1.2 acme.sh 续期钩子缺失（**现存缺陷**）
- cron 已配置：`39 0 * * * /home/ubuntu/.acme.sh/acme.sh --cron`（ubuntu 用户）。
- 但 `~/.acme.sh/account.conf` 中**没有 `Le_ReloadCmd`**。
- **后果**：证书每次续期成功（现有 4 套证书今日 19:23 已续），但 **nginx 不会 reload**，进程内仍是旧证书 → **约 90 天后证书过期且 nginx 持续提供旧证书**，属于缓慢失败，本方案的任何步骤都发现不了。
- **处理**：为 acme.sh 设置 `Le_ReloadCmd='nginx -s reload'`（或 `systemctl reload nginx`），一并修复现有 4 个站点。

### 3.1.3 SSH 暴露面（**现存缺陷**）
- `ufw` **inactive**，`iptables -nL INPUT` 策略 **ACCEPT**，**fail2ban 未启用**。
- 即 **22 端口对全互联网开放且无爆破防护**。
- 影响：GitHub Actions runner 可以直连 SSH（部署路径可行），但这是该机器的既有安全风险，应单独评估收紧（限源 IP 或启用 fail2ban）。

### 3.2 数据层：阿里云 ECS 139.196.89.64
- MySQL 8.4.7，监听 `0.0.0.0:3306`（`bind-address = 0.0.0.0`，`/etc/my.cnf:5`）。
- 注意：实际监听在容器 `172.23.212.135:3306`，宿主机经 DNAT 转发。排查问题时需进容器。
- 数据库：`yishan`、`yishan-admin`、`yishan-example`、`yishan_demo`、`yishan_prod`、`console_codecloud_api_db`。
- 用户（来源均为 `%`）：`yishan_app`、`yishan_demo_app`、`codecloud` 等。
- Redis 6379，**必须带口令**（已用口令验证 PING 返回 PONG）。
- **安全组 `sg-uf6bl327dijrauls3ism` 现状**：入方向原有 6 条（22/80/443/7000/13389/15901，均 `0.0.0.0/0`）。已新增 2 条：`3306`、`6379` 来源限定 `43.143.122.225/32`。**已完成并实测连通。**

### 3.3 出口 IP 的两条路径（重要）
- 普通 TCP 出站（如到 3306）→ 阿里云侧观察到来源为 `43.143.122.225`。**数据库白名单按此 IP 配置，正确。**
- HTTP/HTTPS 出站（如访问 Cloudflare）→ 对端观察到 `203.198.250.78`（腾讯 NAT 池）。已确认无代理进程、无 iptables REDIRECT。机制未查明，但实测稳定。
- 推论：若将来阿里云上新增需要放行本服务器的 **Web 服务**，来源 IP 应使用 `203.198.250.78`，**不可**套用数据库那两条规则。

### 3.4 域名现状
DNS 托管在**阿里云 personal 账号**的 `zerocmf.com`（共 23 条记录，可读写）。与本次部署相关的：

| 记录 | 当前值 | 需要的动作 |
|---|---|---|
| `admin` | **不存在** | 新增 A 记录 → `43.143.122.225` |
| `h5` | CNAME → `1650595695532785.cn-shanghai.fc.aliyuncs.com` | **改为 A 记录** → `43.143.122.225` |
| `yishan` | CNAME → 同一 FC 域名 | 见下方说明 |
| `dsh` / `agent` | A → `43.143.122.225` | 无需改动（已指向腾讯云） |

`studio`、`yishan`、`tan`、`docbase`、`flow`、`www` 等多个 CNAME 同样指向该 FC。

**关于 `yishan.zerocmf.com`**：它当前也指向 FC。需确认它是否是演示环境 admin 的既有入口。
- 若**是**：应直接把它改为 A → `43.143.122.225`，比新增 `admin.zerocmf.com` 更合理（保留既有入口，避免两个域名指向同一服务）。
- 若**不是**（另有用途）：按本方案新增 `admin.zerocmf.com`。
此点须在开工前确认（见 §9）。

### 3.5 线上当前状态：FC 已停用（实测）
```
https://yishan.zerocmf.com/api/health
  → 403 {"Code":"InvokeDisabled","Message":"The function invocation is disabled"}
https://h5.zerocmf.com/api/health
  → 403 {"Code":"InvokeDisabled","Message":"The function invocation is disabled"}
```
**两个 FC 函数均已被停用，演示环境当前处于线上不可用状态。**

因此本次工作的性质是**重建一个已下线的部署**，而非迁移一个正在运行的服务。验收标准应按"从零恢复可用"设定，且不应对"迁移期间旧服务仍可用"作任何假设。

### 3.6 应用产物（关键：无需改代码）
已通过代码核实，以下均与部署平台无关：

- `scripts/package-api.mjs` 通过 `pnpm deploy --prod` 产出**自包含目录**：`package.json` + 生产依赖 `node_modules` + `dist/` + `public/admin/`。已排除 devDependencies。
- 启动命令 `node dist/main.js`，默认监听 `0.0.0.0:3100`（**必须显式设 `PORT`**）。
- **API 进程已托管 admin 静态资源**：`packages/core/system-api/.../static.ts` 将 `<产物根>/public/admin` 挂到 `ADMIN_BASE_PATH`（默认 `/admin`），SPA 路由回退到 `index.html`；生产 + 子路径 + `ADMIN_REDIRECT_ROOT=true` 时 `GET /` 301 到 `/admin/`。
- `GET /api/health` 为公开路由，返回 `{status, db:{ok,...}}`，可直接用于健康检查。
- `main.ts` 已处理 SIGTERM 优雅关闭，适合 systemd。
- Admin 构建产物 `apps/demo/admin/dist`，其中 `PUBLIC_PATH` 与 `__API_BASE_URL__` 为构建期注入。
- H5 产物 `apps/demo/app/dist/h5`，hash 路由；现有 `deploy/fc3/server.mjs` 为零依赖静态服务器（可直接用，但本方案改用 nginx 托管，见 §6.1）。

### 3.7 必须遵守的两个易错点
1. **`PUBLIC_PATH`（构建期）必须等于 `ADMIN_BASE_PATH`（运行期）**，否则静态资源 404 白屏。当前约定值为 `/admin`。
2. **`TRUST_PROXY_IPS` 必须改为 `127.0.0.1`**。FC 环境下的值是 `21.0.0.1`（FC 特有），沿用会导致 `request.ip` 恒错，登录日志、审计、限流全部失效。代码强制要求显式 IP/CIDR，禁止 `true`。

## 4. 整体架构

```
                      ┌─────────── 43.143.122.225 (腾讯云 Ubuntu) ───────────┐
 用户 ────HTTPS──────► │ nginx:443                                       │
                      │   ├── admin.zerocmf.com  → /api → 127.0.0.1:3000   │
                      │   │                          /  → 301 /admin/     │
                      │   └── h5.zerocmf.com      → /    → 静态目录        │
                      │                              /api → 127.0.0.1:3000 │
                      │                                                  │
                      │   yishan-api.service (systemd)                     │
                      │     node dist/main.js   PORT=3000                 │
                      │     ├─ /api/*  业务路由                            │
                      │     └─ /admin/*  托管 admin SPA 静态资源           │
                      └──────────────────────────────────────────────────┘
                                        │  出站 43.143.122.225
                                        │  (安全组已放行 3306/6379)
                      ┌─────────────────▼─────────────────────────────────┐
                      │ 139.196.89.64 (阿里云 ECS)                        │
                      │   MySQL 8.4.7  yishan_demo   (yishan_demo_app)    │
                      │   Redis 6379   (带口令)                           │
                      └───────────────────────────────────────────────────┘
```

设计要点：
- **单进程提供 API 与 admin**，因为 API 已内置 admin 静态托管，无需再起 nginx 静态目录。
- **两个域名反代到同一个后端进程**，各自带 `/api` 规则。Admin 与 H5 的 API base 均为**同源相对路径**（构建期 `__API_BASE_URL__` 为空串），因此不存在跨域问题。
- H5 纯静态由 nginx 托管，不占额外进程（省内存）。

## 5. 部署形态决策

### 5.1 采用 systemd + rsync，不使用 Docker（我的决定）
**理由**：
- 产物本身已是平台无关的自包含目录，`node dist/main.js` 直接可跑，不需要镜像构建层，省掉 Dockerfile 与构建缓存这一整类问题。
- 该机内存仅 2.4G 可用，Docker daemon 本身有常驻开销；systemd 更省。
- 部署即「传文件 + 重启」，回滚即「切回上一版目录 + 重启」，逻辑简单可审计。

**如需改为 Docker**：唯一需新增的是 Dockerfile 与 compose 文件，`package-api.mjs` 的输出目录可直接作为镜像内容，其余设计不变。请在开工前告知。

### 5.2 目录规划（服务器）
```
/opt/yishan/
├── current -> releases/20261019-120000        # 软链接，指向当前版本
├── releases/
│   ├── 20261019-120000/                      # 产物（package.json/node_modules/dist/public）
│   └── 20261019-090000/                     # 上一版，用于回滚
├── shared/
│   └── .env                                 # 环境变量与口令，0600，属主 root，仅 systemd 读取
└── logs/                                     # 由 journald 接管，此目录仅存少量切换日志
```
- 每次部署新建带时间戳的 `releases/<ts>/`，切换 `current` 软链接后重启服务。
- **保留最近 3 个版本**，更旧的清理。

### 5.3 systemd 单元（要点）
- `WorkingDirectory=/opt/yishan/current`
- `ExecStart=/usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node dist/main.js`
  （**不使用 nvm 路径**，理由见 §3.1.1）
- `EnvironmentFile=/opt/yishan/shared/.env`
- 监听 `127.0.0.1:3000`，**不暴露到公网**（只经 nginx 访问）。
- `Restart=on-failure`，配合应用自身的 SIGTERM 优雅关闭。
- 日志走 journald，便于 `journalctl -u yishan-api` 排查。

### 5.3.1 上传文件目录（必须外置于 release 目录）
`packages/core/system-api/src/config/storage.ts` 将 uploads 解析为 `join(<产物根>/public/uploads)`。若产物根是 `/opt/yishan/current`（指向 `releases/<ts>`），则**上传文件会写进 release 目录**——切换版本或清理旧版本时会静默丢失，且历史 `/uploads/...` 链接 404。

- **处理**：令 `public/uploads` 为指向 `shared/uploads` 的**软链接**，随版本目录一起生成但指向版本目录之外。`shared/uploads` 独立于 release 生命周期，回滚与清理均不影响。
- 若确认演示环境不产生任何上传文件，可省略本项，但需显式确认（见 §9）。

### 5.4 H5 托管
- H5 产物置于 `/opt/yishan/h5/current/public`（同样用软链接切换）。
- nginx `root` 指向该目录，`try_files $uri $uri/ /index.html;`（Taro hash 路由，必须保留 fallback）。
- H5 产物文件名不含内容哈希，`Cache-Control` 不可设为长缓存，沿用现有 `server.mjs` 的判断：不缓存或短缓存。

## 6. 配置项清单

### 6.1 `/opt/yishan/shared/.env`（权限 0600，属主 root）
| 变量 | 值 | 说明 |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | **必须显式设置**，否则默认 3100 |
| `HOST` | `127.0.0.1` | 仅本机可达，由 nginx 反代 |
| `DATABASE_URL` | `mysql://yishan_demo_app:<pwd>@139.196.89.64:3306/yishan_demo` | **不得写 127.0.0.1**（本机 3306 是另一个库） |
| `REDIS_URL` | `redis://:<pwd>@139.196.89.64:6379/0` | 同上，本机 6379 不可用 |
| `JWT_SECRET` | （高强度随机值） | 生产环境弱值会拒绝启动 |
| `CACHE_NAMESPACE` | `yishan:demo` | |
| `TRUST_PROXY_IPS` | `127.0.0.1` | **必须改**，不可沿用 FC 的 `21.0.0.1` |
| `ADMIN_BASE_PATH` | `/admin` | 必须与构建期 `PUBLIC_PATH` 语义一致。注意**仓库现有两个 workflow 的默认值是 `/admin/`（带尾斜杠）**，不要改成 `/admin`。`createAdminConfig` 会裁剪尾斜杠故运行期无碍，但 Umi 的 `publicPath` 不会被同等归一化，尾斜杠必须原样沿用 |
| `ADMIN_REDIRECT_ROOT` | `true` | 保持默认，`/` 归 admin |
| `LOG_LEVEL` | `info` | |

### 6.2 构建期注入（CI 中）
| 变量 | 值 | 说明 |
|---|---|---|
| `PUBLIC_PATH` | `/admin` | 与 `ADMIN_BASE_PATH` 严格一致 |

### 6.3 nginx 站点（新增 2 个，不改现有 4 个）
新增文件 `/etc/nginx/sites-available/yishan-admin.conf` 与 `yishan-h5.conf`，软链到 `sites-enabled`，配置沿用现有约定（证书路径 `/etc/nginx/certs/<域名>.fullchain.crt`，80 端口 `root /var/www/acme-challenge` 供 acme.sh http-01 校验）。

两个站点都需要：
- 80 端口仅用于 ACME 校验（不重定向到 443，避免 acme.sh 校验失败）。
- 443 端口 `location /api/ { proxy_pass http://127.0.0.1:3000; }` 并传递 `X-Forwarded-For` / `X-Forwarded-Proto` / `Host`。
- **H5 站点额外需要 `location /uploads/ { proxy_pass http://127.0.0.1:3000; }`**。原因：H5 构建的 API base 为空串（同源相对），而 `apps/demo/app/src/api/admin/attachments.ts:60` 以 `${API_BASE_URL}/${path}` 构造附件 URL，因此 H5 上的附件预览会请求 `h5.zerocmf.com/uploads/...`。若不加这条规则，`try_files` 会把它落到 `index.html`，图片控件拿到 HTML 而静默失败。
- H5 站点额外 `root` 到 H5 静态目录 + `try_files` fallback。

`admin.zerocmf.com` 的 `/` 由后端 301 到 `/admin/`（`ADMIN_REDIRECT_ROOT=true`），nginx 不需额外处理。

## 7. 数据库迁移的安排

**重要发现**：`db:migrate` 实际是 `node dist/scripts/migrate.js`，只读取产物内的 `dist/modules/<id>/drizzle/*.sql` 与 `_journal.json`，**不需要 devDependencies、不需要 workspace 全量安装**。因此迁移可以直接在服务器上跑，不需要 CI 全量编译。

参数严格枚举：`--check | --dry-run | --apply | --reconcile-dry-run | --reconcile-apply`，**无隐式写库**。

**安排**：部署顺序为「上传产物 → 服务器上 `--dry-run` 人工确认 → `--apply` → 切软链接 → 重启 → 健康检查」。

**取舍说明**：迁移从 CI 的硬门禁变为服务器上的运维动作，失去了自动中止与集中审计。这是为简化部署链路付出的代价，对演示环境可接受。若后续要求恢复 CI 门禁，改回 SSH 隧道方案即可（`scripts/package-api.mjs` 与迁移脚本均无需改动）。

## 8. CD 设计

### 8.1 保留 / 改造
| 文件 | 处理 |
|---|---|
| `.github/workflows/yishan-api-cd.yml` | **重写**：`s deploy` + OIDC 段替换为 rsync + systemctl restart |
| `.github/workflows/yishan-h5-cd.yml` | **重写**：改为 rsync H5 产物；删除 `deploy-domain` job（证书交给服务器侧 acme.sh） |
| `.github/workflows/yishan-fc-migrate.yml` | **删除**。⚠️ **必须同时从 `yishan-api-cd.yml` 的 `paths:` 中移除对该文件的引用**（`yishan-api-cd.yml:12`），否则 `scripts/check-deploy-workflows.mjs` 的 `missing-workflow` 检查（line 89-94）会因引用了不存在的文件而让 CI 失败 |
| `.github/workflows/yishan-cert-rotate-fc.yml` | **删除**，由服务器 acme.sh 续期取代 |
| `.github/workflows/yishan-h5-cert-rotate.yml` | **删除**，同上 |
| `.github/workflows/yishan-fullstack-ci.yml` | 不变 |

### 8.2 新 workflow 的硬性约束
`scripts/check-deploy-workflows.mjs` 是 CI 中的静态守卫，新 workflow 必须满足：
- 触发条件为 `push` 到 `main` 或 `workflow_dispatch`（否则报 `no-trigger`）。注意守卫 line 105：`push main` **且无** `workflow_dispatch` 是硬失败，故新发布 workflow **两者都要有**（报 `no-manual-trigger`）。
- `skip_ci_gate` 的 default 必须为 `false`。
- 每个 `run: |` 块必须通过 `bash -n` 与 heredoc 闭合检查。
- 守卫中 `publishes` 的正则只识别 `s deploy` / `qupload2` / `db:migrate --apply`。改用 rsync 后**不会触发** `no-ci-gate` 检查，但**仍应保留 `ci-gate` job 与 `needs: ci-gate`** 以维持门禁一致性。

### 8.3 需要的 GitHub secrets / vars
新增 secrets：`YISHAN_DEPLOY_SSH_KEY`、`YISHAN_DEPLOY_HOST`、`YISHAN_DEPLOY_USER`、`YISHAN_DEPLOY_KNOWN_HOSTS`。
新增 vars：`ADMIN_PUBLIC_PATH`（默认 `/admin`）、`YISHAN_ADMIN_DOMAIN`、`YISHAN_H5_DOMAIN`、`SMOKE_BASE_URL`。

`YISHAN_API_JWT_SECRET` 等现有 secret 需确保存在于新的 GitHub Environment（若沿用 `YISHAN_API` environment 则无需变更）。

### 8.4 部署后冒烟检查
沿用现有逻辑，改为对腾讯云域名执行：
1. 轮询最多 10 次 `https://admin.zerocmf.com/api/health`，断言 `success == true`、`data.status == "ok"`、`data.db.ok == true`。
2. 断言 `https://admin.zerocmf.com/admin/` 返回 200。
3. 断言 `https://h5.zerocmf.com/` 返回 200 且含 `<title>yishan-app</title>`。

## 9. 前置条件

### 9.1 已解决（2026-10-19）
- **数据库**：库 `yishan_demo`（已迁移，含 55 张表）、用户 `yishan_demo_app`（对 `yishan_demo` 具备 ALL PRIVILEGES）。该用户原口令不明且无任何现存系统使用（FC 已停用），已由本方案重设口令并验证可登录。Redis 使用既有口令（已验证 PING 返回 PONG）。凭证存于 `~/.config/env-config/yishan-demo.yaml`。
- **DNS 操作权限**：阿里云 personal 账号对 `zerocmf.com` 具备读写权限（23 条记录）。
- **FC 处置范围**：**`yishan-crm` 不动**。FC 删除在腾讯云部署完成并验证可用之后单独对齐，不在本次范围内。FC 上另有 10 个与 yishan 无关的线上函数（`_webide-server`、`agentrun-*`、`content-flow*`、`daifuyang-com`、`e2b-sandbox`×4、`genlabs*`），**一律不动**。

### 9.2 待完成
1. **DNS 变更**：
   - 新增 `admin` A 记录 → `43.143.122.225`。
   - 将 `h5` 从 CNAME（FC）改为 A 记录 → `43.143.122.225`。
2. **`yishan.zerocmf.com` 的去留**：当前指向已停用的 FC（返回 403）。是复用为 admin 入口，还是随 FC 删除一并清理，**留待 FC 对齐时决定**，本次不阻塞。
3. **生成 JWT_SECRET**：高强度随机值，写入 `shared/.env`。更换后所有旧会话失效——因演示环境已下线，无影响。

## 10. 回滚方案

- 每次部署保留上一版 `releases/<ts>/`。
- 回滚 = 把 `current` 软链接切回上一版 + `systemctl restart yishan-api` + 重跑健康检查。
- **数据库不做自动回滚**：迁移为向前兼容设计，如需回退代码而数据库已升级，应人工确认兼容性。

## 11. 顺带发现的安全隐患（不在本次范围内，建议单独处理）

1. `apps/demo/app/deploy/fc3/certs/private.key` 与 `fullchain.cer` **证书私钥已签入 Git 仓库**。应从版本控制移除并轮换。
2. `apps/demo/api/deploy/fc3/.build/function-code/` **构建产物已签入仓库**，含完整 `dist/` 与 `node_modules/` 闭包。应加入 `.gitignore` 并移除。
3. 阿里云安全组 `22`、`80`、`443`、`7000`（注释标注 "frp内外映射，请勿删除"）、`13389`、`15901` 全部对 `0.0.0.0/0` 开放。数据库已收紧为固定 IP，这几个端口的暴露面明显更宽，建议单独评估。

## 12. 需要同步更新的文档

- `apps/portal/docs/content/deploy/prod.md`（现通篇描述 FC 语义）
- `apps/demo/api/deploy/fc3/docs/environment-variables.md`（`TRUST_PROXY_IPS` 一节需重写）
- `apps/demo/api/deploy/fc3/README.md`
- `docs/engineering/release.md`（描述两条 FC CD 工作流）
- 根 `CLAUDE.md`（"Deploy" 一段描述 FC 与七牛，需更新）
