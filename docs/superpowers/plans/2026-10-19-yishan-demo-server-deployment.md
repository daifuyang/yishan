# yishan 演示环境单机部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 yishan 演示环境（admin + API + H5）从已停用的阿里云 FC 迁移到腾讯云 Ubuntu 43.143.122.225，以 systemd + nginx 单机形态运行。

**Architecture:** API 产物（`pnpm deploy --prod` 自包含目录）由 CI rsync 到服务器 `/opt/yishan/releases/<ts>/`，`current` 软链接切换后重启 systemd 服务。API 进程同时提供 `/api/*` 与托管 `/admin/*` 静态资源；H5 由 nginx 直接托管静态目录。两个域名各自反代到同一个后端进程。数据库与 Redis 留在阿里云 ECS 139.196.89.64。

**Tech Stack:** Node 22.22.1（系统级，非 nvm）、systemd、nginx 1.24.0、rsync over SSH、GitHub Actions、acme.sh（http-01）

**Spec:** `docs/superpowers/specs/2026-10-19-yishan-demo-server-deployment-design.md`

## Global Constraints

以下每条均为硬约束，任何任务都隐含包含：

- **不得写 `/admin` 作为 `PUBLIC_PATH`**。仓库现有两个 workflow 的默认值是 `'/admin/'`（带尾斜杠），Umi 的 `publicPath` 不做等价归一化，必须原样沿用。
- **`DATABASE_URL` / `REDIS_URL` 主机必须是 `139.196.89.64`**，绝不可写 `127.0.0.1`——服务器上已有别的 MySQL/Redis 容器占用 3306/6379。
- **`TRUST_PROXY_IPS=127.0.0.1`**。不可沿用 FC 的 `21.0.0.1`，否则 `request.ip` 恒错。
- **`PORT=3000` 必须显式设置**（应用默认 3100）。
- **`HOST=127.0.0.1`**，API 端口不暴露公网，只经 nginx 访问。
- **Node 必须是系统级 22.22.1**，路径固定 `/usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node`。不可使用 nvm 路径（用户级，systemd 以 root 运行无法解析，且升级会失效）。
- **口令、私钥、JWT_SECRET 一律不得进入仓库或 workflow 明文**，只经 GitHub secrets 与服务器 `shared/.env`（0600 root）传递。
- **不得改动服务器上现有的 4 个 nginx 站点与 3 个 Docker 容器**。
- **不得删除任何 FC 函数**（`yishan-crm` 及其余 10 个线上函数均不动）。FC 删除不在本计划范围。
- 一切写入操作遵循 Conventional Commits。

## Review Focus

以下五类是 spec 隐含、但没有任务直接覆盖，最可能伤到真实使用者的失败模式：

1. **`yishan_demo` 上传文件丢失**——`storage.ts` 把 uploads 解析为 `<产物根>/public/uploads`。若产物根是 release 目录，回滚或清理旧版会静默删掉用户上传的附件，且历史 `/uploads/...` 链接 404。Task 3 处理。
2. **CD 在 CI 未通过时仍发布**——guardrail 要求 `needs: ci-gate`。若新 workflow 漏掉，未经 CI 的 commit 会直接进演示环境。Task 9 处理。
3. **删掉 workflow 导致 CI 全红**——`yishan-api-cd.yml:12` 的 `paths:` 引用了 `yishan-fc-migrate.yml`，删除文件而不移除引用会触发 guardrail 的 `missing-workflow`。Task 10 处理。
4. **admin 构建期 `PUBLIC_PATH` 与运行期 `ADMIN_BASE_PATH` 不一致**——不一致时静态资源全 404，页面白屏，且没有任何错误日志。Task 8 的冒烟检查覆盖。
5. **H5 上的附件预览静默失败**——附件 URL 是同源相对路径，H5 站点若无 `/uploads/` 反代，`try_files` 会返回 `index.html`，图片控件拿到 HTML 而不报错。Task 6 处理。

---

## Deliberately Out of Scope

以下两项是 spec §11 记录的安全缺陷，**不在本计划内**，需单独决策与实施：

- **腾讯云服务器 SSH 22 端口对全互联网开放**（ufw inactive、iptables INPUT 策略 ACCEPT、fail2ban 未启用）。该机上跑着 MySQL、Postgres、Redis 与 4 个线上站点。收紧涉及防火墙配置，有把操作者自己关在门外的风险，应单独做。本计划**依赖** 22 端口可从 GitHub runner 访问（Task 9 的 rsync 依赖它），因此收紧时须同步改为自托管 runner 或跳板机。
- **阿里云安全组 `22`/`80`/`443`/`7000`/`13389`/`15901` 对 `0.0.0.0/0` 开放**。数据库两条规则已按固定 IP 收紧，这几条是既有状态，与本次部署无关。

## File Structure

| 文件 | 责任 |
|---|---|
| `apps/demo/api/deploy/server/README.md` | 服务器部署说明（人工运维读） |
| `apps/demo/api/deploy/server/scripts/pre-deploy.sh` | 构建 API 产物到本地 `.build/function-code` |
| `apps/demo/api/deploy/server/scripts/release.sh` | **在服务器上执行**：校验产物、切软链接、重启、健康检查 |
| `apps/demo/api/deploy/server/templates/yishan-api.service` | systemd 单元模板 |
| `apps/demo/api/deploy/server/templates/env.example` | `.env` 模板（无真实口令），供人工创建 `shared/.env` |
| `apps/demo/app/deploy/server/scripts/pre-deploy.sh` | 构建 H5 产物到本地 `.build/public` |
| `.github/workflows/yishan-api-cd.yml` | **重写**：rsync + release.sh + 冒烟检查 |
| `.github/workflows/yishan-h5-cd.yml` | **重写**：rsync H5 产物 |
| 服务器 `/opt/yishan/bin/release.sh` | 从 `templates/` 同步而来的副本（Task 4） |
| 服务器 `/etc/nginx/sites-available/yishan-admin.conf` | admin 站点 vhost |
| 服务器 `/etc/nginx/sites-available/yishan-h5.conf` | H5 站点 vhost |

---

### Task 1: 服务器安装系统级 Node 22.22.1

**Files:**
- 服务器：`/usr/local/lib/nodejs/node-v22.22.1-linux-x64/`

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: 绝对路径 `/usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node`，`node -v` 输出 `v22.22.1`。Task 3 的 systemd 单元依赖此路径。

- [ ] **Step 1: 确认当前 Node 版本并记录（预期不是 22.22.1）**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 'node -v 2>/dev/null; echo "---"; ls /usr/local/lib/nodejs/ 2>/dev/null || echo "尚无系统级 node"'
```

Expected: 输出 `v24.19.0`（nvm 路径），且 `/usr/local/lib/nodejs/` 不存在。**不要修改或删除 nvm 的 Node 24**——服务器上其他东西可能在用。

- [ ] **Step 2: 下载并解压官方 Node 22.22.1 二进制**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 '
set -euo pipefail
cd /tmp
curl -fsSLO https://nodejs.org/dist/v22.22.1/node-v22.22.1-linux-x64.tar.xz
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJf node-v22.22.1-linux-x64.tar.xz -C /usr/local/lib/nodejs
rm -f node-v22.22.1-linux-x64.tar.xz
'
```

Expected: 无输出，退出码 0。

- [ ] **Step 3: 验证版本正确且路径固定**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 '/usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node -v'
```

Expected: 精确输出 `v22.22.1`。**若输出 `v24.19.0` 说明解到了错误路径，必须修正后再继续。**

- [ ] **Step 4: 确认 tarball 校验和（防止下载到被篡改的产物）**

```bash
curl -fsSL https://nodejs.org/dist/v22.22.1/SHASUMS256.txt | grep 'node-v22.22.1-linux-x64.tar.xz$'
```

Expected: 输出一行 `<hash>  node-v22.22.1-linux-x64.tar.xz`。将其 hash 与服务器上文件比对：

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 'sha256sum /tmp/node-v22.22.1-linux-x64.tar.xz 2>/dev/null || echo "已清理，请重新下载后立即校验"'
```

若 Step 2 已 `rm` 了 tarball，则重新下载、校验、再删除。

- [ ] **Step 5: 提交记录**

本任务不改仓库文件，无需 commit。在 Task 2 首个改动提交时，用 commit message body 记录 Node 版本决策。

---

### Task 2: 服务器目录结构与 deploy 用户

**Files:**
- 服务器：`/opt/yishan/{releases,shared,bin,h5,incoming}/`

**Interfaces:**
- Consumes: Task 1 的 Node 路径
- Produces: 目录约定 `/opt/yishan/releases/<ts>/`、`/opt/yishan/shared/.env`、`/opt/yishan/bin/release.sh`、`/opt/yishan/h5/<ts>/`。Task 3/4/5 依赖。

- [ ] **Step 1: 创建目录并设置属主**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 '
set -euo pipefail
sudo mkdir -p /opt/yishan/{releases,shared/uploads,bin,h5,incoming}
sudo chown -R ubuntu:ubuntu /opt/yishan
sudo chmod 755 /opt/yishan
'
```

Expected: 退出码 0。

- [ ] **Step 2: 确认 uploads 目录独立于 releases**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 'ls -ld /opt/yishan/releases /opt/yishan/shared/uploads'
```

Expected: 两个目录都存在，且 `shared/uploads` **不在** `releases/` 之下。这是 Review Focus #1 的前提。

- [ ] **Step 3: 创建服务器端 `.env`（凭据来自 env-config，不入库）**

读取 `~/.config/env-config/yishan-demo.yaml`，在服务器创建 `/opt/yishan/shared/.env`：

```
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=<yishan-demo.yaml 中 database.url 的值>
REDIS_URL=<yishan-demo.yaml 中 redis.url 的值>
JWT_SECRET=<新生成的高强度随机值>
CACHE_NAMESPACE=yishan:demo
TRUST_PROXY_IPS=127.0.0.1
ADMIN_BASE_PATH=/admin
ADMIN_REDIRECT_ROOT=true
LOG_LEVEL=info
```

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  'sudo install -m 600 -o root -g root /dev/stdin /opt/yishan/shared/.env' < /tmp/yishan-demo.env
```

Expected: 文件创建成功。

- [ ] **Step 4: 验证权限为 0600 且属主 root**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 'ls -l /opt/yishan/shared/.env'
```

Expected: `-rw------- 1 root root ... /opt/yishan/shared/.env`。**若是 `-rw-r--r--` 或属主为 ubuntu，必须修正——systemd 以 root 运行，但口令文件不应被 ubuntu 以外的任何人读取，且绝不可 world-readable。**

- [ ] **Step 5: 验证 .env 里没有 FC 遗留值（防止复制粘贴带入 `21.0.0.1`）**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 'sudo grep -nE "TRUST_PROXY_IPS|127\.0\.0\.1:3306|21\.0\.0\.1" /opt/yishan/shared/.env'
```

Expected: `TRUST_PROXY_IPS=127.0.0.1` 一行；**无** `21.0.0.1`；**无**指向 `127.0.0.1:3306` 或 `:6379` 的连接串。

---

### Task 3: systemd 单元模板与上传目录软链接

**Files:**
- Create: `apps/demo/api/deploy/server/templates/yishan-api.service`
- Create: `apps/demo/api/deploy/server/templates/env.example`
- 服务器：`/etc/systemd/system/yishan-api.service`、`/opt/yishan/bin/release.sh`（Task 4 放置）

**Interfaces:**
- Consumes: Task 1 的 Node 路径、Task 2 的目录约定
- Produces: systemd 单元 `yishan-api`，服务名 `yishan-api.service`。Task 4 的 `release.sh` 调用 `systemctl restart yishan-api`。

- [ ] **Step 1: 创建 systemd 单元模板**

`apps/demo/api/deploy/server/templates/yishan-api.service` 全文：

```ini
[Unit]
Description=yishan demo API (serves /api and /admin)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/yishan/current
EnvironmentFile=/opt/yishan/shared/.env
ExecStart=/usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node dist/main.js
Restart=on-failure
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

`User=ubuntu` 而非 root：应用无需 root 权限，且能读写 `/opt/yishan/shared/uploads`。**注意这意味着 `shared/.env`（0600 root）对服务进程不可读**——若启动报权限错误，将 `.env` 属主改为 `root:ubuntu` 且权限 `640`。此为已知取舍，在 Task 8 Step 6 验证（服务首次真实启动时）。

- [ ] **Step 2: 创建 `.env` 模板（无真实凭据）**

`apps/demo/api/deploy/server/templates/env.example` 全文：

```
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=mysql://<user>:<password>@139.196.89.64:3306/yishan_demo
REDIS_URL=redis://:<password>@139.196.89.64:6379/0
JWT_SECRET=<generate-with-openssl-rand-hex-32>
CACHE_NAMESPACE=yishan:demo
TRUST_PROXY_IPS=127.0.0.1
ADMIN_BASE_PATH=/admin
ADMIN_REDIRECT_ROOT=true
LOG_LEVEL=info
```

- [ ] **Step 3: 验证模板中无真实凭据入库**

```bash
node -e "const t=require('fs').readFileSync('apps/demo/api/deploy/server/templates/env.example','utf8'); const bad=t.match(/Codecloud2025\.|mysql:\/\/[^<\s][^\s]*@/); if(bad){console.error('泄漏:',bad[0]);process.exit(1)} console.log('OK: 模板无真实凭据')"
```

Expected: `OK: 模板无真实凭据`。**若失败说明粘贴时带入了真口令，必须清除后再提交。**

- [ ] **Step 4: 提交模板**

```bash
git add apps/demo/api/deploy/server/templates/
git commit -m "feat(deploy): add systemd unit and env template for server deployment

Node 22.22.1 must be installed system-wide (not nvm): systemd runs as a
non-root user and nvm paths are user-scoped and break on Node upgrades."
```

---

### Task 4: 服务器端 release.sh（软链接切换 + 重启 + 健康检查）

**Files:**
- Create: `apps/demo/api/deploy/server/scripts/release.sh`
- 服务器：`/opt/yishan/bin/release.sh`

**Interfaces:**
- Consumes: Task 2 的目录约定、Task 3 的服务名 `yishan-api`
- Produces: 命令 `bash /opt/yishan/bin/release.sh <timestamp>`。Task 9 的 CI 调用它。
  退出码 0 = 发布成功；非 0 = 失败（且已自动回滚）。

- [ ] **Step 1: 写 `release.sh`**

`apps/demo/api/deploy/server/scripts/release.sh` 全文：

```bash
#!/usr/bin/env bash
# 在服务器上执行：校验新 release、切换软链接、重启、健康检查，失败自动回滚。
# 用法: bash /opt/yishan/bin/release.sh <timestamp>
set -euo pipefail

ROOT=/opt/yishan
TS="${1:?Usage: release.sh <timestamp>}"
NEW="$ROOT/releases/$TS"
PREV="$(readlink -f "$ROOT/current" 2>/dev/null || true)"

log() { echo "[release $TS] $*"; }

[ -d "$NEW" ] || { echo "release dir missing: $NEW" >&2; exit 1; }
[ -f "$NEW/dist/main.js" ] || { echo "missing dist/main.js" >&2; exit 1; }
[ -f "$NEW/.yishan-api-artifact.json" ] || { echo "missing artifact marker" >&2; exit 1; }

# uploads 必须指向 release 目录之外的 shared/uploads，否则回滚/清理会丢用户文件。
if [ ! -L "$NEW/public/uploads" ]; then
  mkdir -p "$NEW/public"
  ln -sfn "$ROOT/shared/uploads" "$NEW/public/uploads"
fi
mkdir -p "$ROOT/shared/uploads"

rollback() {
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    log "health check failed, rolling back to $PREV"
    ln -sfn "$PREV" "$ROOT/current"
    systemctl restart yishan-api
  else
    log "health check failed and no previous release to roll back to"
  fi
  exit 1
}

ln -sfn "$NEW" "$ROOT/current"
log "switched current -> $NEW"
systemctl restart yishan-api

for i in $(seq 1 15); do
  if curl -fsS --max-time 4 http://127.0.0.1:3000/api/health 2>/dev/null | grep -q '"status":"ok"'; then
    log "healthy"
    # 只保留最近 3 个版本，避免磁盘无限增长
    ls -1dt "$ROOT"/releases/*/ | tail -n +4 | while read -r old; do
      [ "$old" = "$NEW/" ] || rm -rf "$old"
    done
    exit 0
  fi
  sleep 2
done

echo "health check did not pass within 30s" >&2
journalctl -u yishan-api --no-pager -n 40 >&2 || true
rollback
```

- [ ] **Step 2: 验证 shell 语法（CI 也有同款守卫）**

```bash
bash -n apps/demo/api/deploy/server/scripts/release.sh && echo "语法 OK"
```

Expected: `语法 OK`。

- [ ] **Step 3: 部署到服务器并赋可执行位**

```bash
scp -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes \
  apps/demo/api/deploy/server/scripts/release.sh ubuntu@43.143.122.225:/opt/yishan/bin/release.sh
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  'chmod +x /opt/yishan/bin/release.sh && bash -n /opt/yishan/bin/release.sh && echo "服务器端语法 OK"'
```

Expected: `服务器端语法 OK`。

- [ ] **Step 4: 提交**

```bash
git add apps/demo/api/deploy/server/scripts/release.sh
git commit -m "feat(deploy): add server-side release script with rollback

Symlinks public/uploads to shared/uploads so switching or pruning releases
cannot silently delete user-uploaded files."
```

---

### Task 5: nginx admin 站点 (admin.zerocmf.com)

**Files:**
- 服务器：`/etc/nginx/sites-available/yishan-admin.conf`、`/etc/nginx/certs/admin.zerocmf.com.{fullchain.crt,key}`

**Interfaces:**
- Consumes: Task 1 的 Node 路径（仅间接）、后端 `127.0.0.1:3000`
- Produces: `admin.zerocmf.com` 对外服务。Task 8 的冒烟检查依赖它。

- [ ] **Step 1: 写 vhost 配置**

`/etc/nginx/sites-available/yishan-admin.conf` 全文：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name admin.zerocmf.com;
    root /var/www/acme-challenge;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.zerocmf.com;

    ssl_certificate     /etc/nginx/certs/admin.zerocmf.com.fullchain.crt;
    ssl_certificate_key /etc/nginx/certs/admin.zerocmf.com.key;

    client_max_body_size 50m;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # / 与 /admin 均交由后端处理：它内置 SPA 托管与 / → /admin/ 的 301。
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 2: 语法校验并启用**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  'sudo nginx -t'
```

Expected: `syntax is ok` / `test is successful`。**必须在签证书后、reload 前再跑一次**——证书文件不存在时 nginx -t 会失败。

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  'sudo ln -sf /etc/nginx/sites-available/yishan-admin.conf /etc/nginx/sites-enabled/ && sudo nginx -t'
```

Expected: `test is successful`。

- [ ] **Step 3: 签发证书（需 Task 7 的 DNS 已生效）**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 '
~/.acme.sh/acme.sh --issue --server letsencrypt -d admin.zerocmf.com -w /var/www/acme-challenge
'
```

Expected: 证书签发成功。**若报 DNS 解析错误，说明 Task 7 未完成——先做 Task 7。**

- [ ] **Step 4: 安装证书并 reload**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 '
set -euo pipefail
sudo mkdir -p /etc/nginx/certs
~/.acme.sh/acme.sh --install-cert -d admin.zerocmf.com \
  --fullchain-file /etc/nginx/certs/admin.zerocmf.com.fullchain.crt \
  --key-file       /etc/nginx/certs/admin.zerocmf.com.key \
  --reloadcmd     "sudo systemctl reload nginx"
sudo chmod 644 /etc/nginx/certs/admin.zerocmf.com.fullchain.crt
sudo chmod 600 /etc/nginx/certs/admin.zerocmf.com.key
sudo nginx -t && sudo systemctl reload nginx
'
```

Expected: `test is successful`，nginx 已加载新证书。

- [ ] **Step 5: 验证未影响现有站点**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 'ls /etc/nginx/sites-enabled/'
```

Expected: 恰好包含原有 4 个（`agent.zerocmf.com.conf`、`codecloud.tech.conf`、`dsh.zerocmf.com.conf`、`yugongsoft.com.conf`）+ 新增 `yishan-admin.conf`。**若原有任一消失，立即停止并恢复备份。**

```bash
for D in agent.zerocmf.com codecloud.tech dsh.zerocmf.com yugongsoft.com; do
  echo -n "$D: "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 "https://$D/"
done
```

Expected: 各项返回与改动前一致的状态码（非 5xx）。

- [ ] **Step 6: 顺带修复 acme.sh 续期不 reload 的现存缺陷**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  'grep -q "^Le_ReloadCmd" ~/.acme.sh/account.conf || echo "Le_ReloadCmd='\''sudo systemctl reload nginx'\''" >> ~/.acme.sh/account.conf'
```

理由：cron 已配置续期，但 `account.conf` 缺 `Le_ReloadCmd`，导致证书续签后 nginx 仍提供旧证书，约 90 天后现有 4 个站点集体过期。本步骤修复该问题，**不属于本次部署范围但成本极低且风险明确**。

---

### Task 6: nginx H5 站点 (h5.zerocmf.com)

**Files:**
- 服务器：`/etc/nginx/sites-available/yishan-h5.conf`、`/opt/yishan/h5-current`

**Interfaces:**
- Consumes: Task 2 的 H5 目录、后端 `127.0.0.1:3000`
- Produces: `h5.zerocmf.com` 对外服务。

- [ ] **Step 1: 写 vhost 配置**

`/etc/nginx/sites-available/yishan-h5.conf` 全文：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name h5.zerocmf.com;
    root /var/www/acme-challenge;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name h5.zerocmf.com;

    ssl_certificate     /etc/nginx/certs/h5.zerocmf.com.fullchain.crt;
    ssl_certificate_key /etc/nginx/certs/h5.zerocmf.com.key;

    client_max_body_size 50m;
    root /opt/yishan/h5-current;

    # H5 的 API base 是同源相对路径；附件 URL 同理指向 /uploads/。
    # 缺这两条会导致附件预览拿到 index.html 而静默失败。
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Taro hash 路由：未命中的路径回退到 index.html。
    # H5 产物文件名不含内容哈希，不可长缓存。
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
```

- [ ] **Step 2: 签发并安装证书**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 '
set -euo pipefail
~/.acme.sh/acme.sh --issue --server letsencrypt -d h5.zerocmf.com -w /var/www/acme-challenge
sudo mkdir -p /etc/nginx/certs
~/.acme.sh/acme.sh --install-cert -d h5.zerocmf.com \
  --fullchain-file /etc/nginx/certs/h5.zerocmf.com.fullchain.crt \
  --key-file       /etc/nginx/certs/h5.zerocmf.com.key \
  --reloadcmd     "sudo systemctl reload nginx"
'
```

Expected: 签发与安装均成功。

- [ ] **Step 3: 启用并 reload**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  'sudo ln -sf /etc/nginx/sites-available/yishan-h5.conf /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx && echo "reload OK"'
```

Expected: `test is successful` + `reload OK`。

- [ ] **Step 4: 确认 6 个站点全部存在**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 'ls /etc/nginx/sites-enabled/ | wc -l'
```

Expected: `6`。

---

### Task 7: DNS 变更

**Files:**
- 阿里云 DNS：`zerocmf.com`（personal 账号）

**Interfaces:**
- Consumes: Task 5/6 的证书签发依赖此任务
- Produces: `admin.zerocmf.com` 与 `h5.zerocmf.com` 均解析到 `43.143.122.225`。

- [ ] **Step 1: 记录变更前状态（便于回滚）**

```bash
aliyun alidns DescribeDomainRecords --DomainName zerocmf.com --PageSize 100 --profile personal \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).DomainRecords.Record;r.filter(x=>["admin","h5"].includes(x.RR)).forEach(x=>console.log(x.RecordId,x.RR,x.Type,x.Value))})'
```

Expected: 输出 `h5` 的 CNAME 记录及其 RecordId；`admin` 无记录。

- [ ] **Step 2: 新增 admin A 记录**

```bash
aliyun alidns AddDomainRecord --DomainName zerocmf.com --RR admin --Type A \
  --Value 43.143.122.225 --TTL 600 --profile personal
```

Expected: 返回含新 `RecordId` 的 JSON。

- [ ] **Step 3: 将 h5 从 CNAME 改为 A**

先删后加（DNS 不允许同名 CNAME 与 A 并存）：

```bash
H5_ID=$(aliyun alidns DescribeDomainRecords --DomainName zerocmf.com --PageSize 100 --profile personal \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).DomainRecords.Record;const h=r.find(x=>x.RR==="h5"&&x.Type==="CNAME");process.stdout.write(h?h.RecordId:"")})')
echo "h5 RecordId=$H5_ID"
aliyun alidns DeleteDomainRecord --RecordId "$H5_ID" --profile personal
aliyun alidns AddDomainRecord --DomainName zerocmf.com --RR h5 --Type A \
  --Value 43.143.122.225 --TTL 600 --profile personal
```

Expected: 删除与新增都返回 RecordId。**Step 1 记录的旧值 `1650595695532785.cn-shanghai.fc.aliyuncs.com` 必须留存以便回滚。**

- [ ] **Step 4: 验证解析生效（全球解析可能有延迟）**

```bash
for D in admin.zerocmf.com h5.zerocmf.com; do
  echo -n "$D -> "; nslookup $D 8.8.8.8 2>/dev/null | grep -A1 "Name:" | tail -1 | tr -d '\r' || echo "未解析"
done
```

Expected: 两行均显示 `43.143.122.225`。若仍未生效，等待 5 分钟后重试，**不要继续 Task 5 Step 3 之前的步骤**。

---

### Task 8: 首次手工部署并验证

**Files:**
- 本地：`.build/function-code/`（gitignored 产物）
- 服务器：`/opt/yishan/releases/<ts>/`、`/opt/yishan/h5/<ts>/`

**Interfaces:**
- Consumes: Task 2/3/4 的服务器准备
- Produces: 一个可用的演示环境。Task 9/10 的 CD 以此为基线。

- [ ] **Step 1: 本地构建 API 产物**

在仓库根目录：

```bash
pnpm install --frozen-lockfile --prod=false
(cd packages/yishan-tiptap && pnpm install --frozen-lockfile && pnpm build)
pnpm --filter @yishan/demo-admin exec max setup
PUBLIC_PATH='/admin/' pnpm --filter @yishan/demo-admin build
pnpm -r --filter @yishan/demo-api... build
```

Expected: 全部成功。**`PUBLIC_PATH` 必须是 `'/admin/'`（带尾斜杠），见 Global Constraints。**

- [ ] **Step 2: 打包产物**

```bash
mkdir -p .build/function-code
node scripts/package-api.mjs --output .build/function-code --admin apps/demo/admin/dist
```

Expected: 脚本自带的 `verifyApiArtifact` + `smokeApiArtifact` 通过（无报错退出）。

- [ ] **Step 3: 确认产物结构符合 release.sh 的前置校验**

```bash
ls .build/function-code/dist/main.js .build/function-code/.yishan-api-artifact.json
```

Expected: 两个文件都存在。

- [ ] **Step 4: 运行数据库迁移（先 dry-run）**

上传产物后，在服务器执行：

```bash
node .build/function-code/dist/scripts/migrate.js --dry-run
```

Expected: 输出 `0 pending`（`yishan_demo` 已有 55 张表，应无待执行迁移）。**若显示有 pending，检查后再决定是否 `--apply`。**

- [ ] **Step 5: rsync 上传并发布**

```bash
TS=$(date -u +%Y%m%d-%H%M%S)
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 "mkdir -p /opt/yishan/releases/$TS"
rsync -az --delete -e "ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes" \
  .build/function-code/ ubuntu@43.143.122.225:/opt/yishan/releases/$TS/
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  "bash /opt/yishan/bin/release.sh $TS"
```

Expected: `[release $TS] healthy`，退出码 0。

- [ ] **Step 6: 后端直连健康检查**

```bash
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  'curl -s http://127.0.0.1:3000/api/health'
```

Expected: `{"success":true,...,"data":{"status":"ok",...,"db":{"ok":true,...}}}`。**若 `db.ok` 为 false，检查 `DATABASE_URL` 是否误写 127.0.0.1（会连到本机那个别的 MySQL）。**

- [ ] **Step 7: 部署 H5 产物**

```bash
(cd apps/demo/app && NODE_ENV=production pnpm run build:h5)
H5TS=$(date -u +%Y%m%d-%H%M%S)
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 "mkdir -p /opt/yishan/h5/$H5TS"
rsync -az --delete -e "ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes" \
  apps/demo/app/dist/h5/ ubuntu@43.143.122.225:/opt/yishan/h5/$H5TS/
ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225 \
  "sudo ln -sfn /opt/yishan/h5/$H5TS /opt/yishan/h5-current && sudo systemctl reload nginx"
```

Expected: 无输出，退出码 0。

- [ ] **Step 8: 端到端冒烟检查（与 CI 中的一致）**

```bash
curl -sf https://admin.zerocmf.com/api/health | grep -q '"status":"ok"' && echo "admin /api/health OK"
curl -sf -o /dev/null -w "admin /admin/ -> %{http_code}\n" https://admin.zerocmf.com/admin/
curl -sf https://admin.zerocmf.com/ -o /dev/null -w "admin / -> %{http_code}\n"
curl -sf https://h5.zerocmf.com/ | grep -q '<title>yishan-app</title>' && echo "H5 根路径 OK"
curl -sf https://h5.zerocmf.com/api/health | grep -q '"status":"ok"' && echo "H5 /api 反代 OK"
```

Expected: 四项全部 OK。**`admin /` 应返回 301 或 200（后端 301 到 `/admin/`）；若返回 404 或 500，说明 `ADMIN_BASE_PATH` 与构建期 `PUBLIC_PATH` 不一致（Review Focus #4）。**

- [ ] **Step 9: 验证 admin 页面静态资源真正加载（不是只返回 200 空壳）**

```bash
curl -sf https://admin.zerocmf.com/admin/ | grep -oE '(src|href)="/admin/[^"]+"' | head -3
```

Expected: 输出若干条 `/admin/...` 路径。**若输出 `/umi.js` 之类无 `/admin/` 前缀的路径，说明 `PUBLIC_PATH` 构建期未生效，页面会白屏——回到 Step 1 修正。**

- [ ] **Step 10: 记录首次发布的时间戳**

```bash
echo "首次发布 TS=$TS  H5 TS=$H5TS"
```

写入 Task 9 workflow 的调试笔记，便于首次自动发布时确认回滚目标。

---

### Task 9: 重写 yishan-api-cd.yml

**Files:**
- Modify: `.github/workflows/yishan-api-cd.yml`（整体重写 deploy 部分）

**Interfaces:**
- Consumes: Task 4 的 `release.sh` 接口、Task 8 验证过的部署路径
- Produces: `yishan-api-cd` workflow，push main 时自动发布 API+admin。

- [ ] **Step 1: 记录 SSH host key 到 GitHub secret**

将以下三行内容作为 **secret** `YISHAN_DEPLOY_KNOWN_HOSTS` 存入 `YISHAN_API` environment：

```bash
ssh-keyscan -t rsa,ecdsa,ed25519 43.143.122.225 2>/dev/null | grep -v '^#'
```

用 pinned host key 而非每次 `ssh-keyscan`，避免 MITM 风险。

- [ ] **Step 2: 新增 secrets 与 vars**

secrets：`YISHAN_DEPLOY_SSH_KEY`、`YISHAN_DEPLOY_KNOWN_HOSTS`、`YISHAN_DEPLOY_HOST`（= `43.143.122.225`）、`YISHAN_DEPLOY_USER`（= `ubuntu`）。
vars：`ADMIN_BASE_PATH`（保持现有 `/admin/`）、`SMOKE_BASE_URL`（改为 `https://admin.zerocmf.com`）。

- [ ] **Step 3: 保留 `ci-gate` 与 `migrate` 两个 job 的结构**

- `ci-gate` job **原样保留**（轮询 `yishan-fullstack-ci.yml` 同一 SHA success）。
- `migrate` job **删除**，迁移改到服务器上由 Task 8 Step 4 的方式执行（理由见 spec §7）。
- ⚠️ 删除 `migrate` 后，**必须从文件顶部的 `paths:` 中移除 `.github/workflows/yishan-fc-migrate.yml`**，否则 guardrail 的 `missing-workflow` 检查会让 CI 失败。

- [ ] **Step 4: 重写 deploy job 的构建段**

保留现有的构建步骤（checkout / setup-node 22.22.1 / corepack pnpm@8.15.9 / `pnpm install --frozen-lockfile --prod=false` / tiptap build / `max setup` / `PUBLIC_PATH` 注入的 admin build / `pnpm -r --filter @yishan/demo-api... build`），**删除** `npm i -g @serverless-devs/s` 与整段 OIDC AssumeRole（约 40 行）。

- [ ] **Step 5: 写部署段**

```yaml
      - name: Configure SSH
        run: |
          set -euo pipefail
          mkdir -p ~/.ssh
          printf '%s\n' "${{ secrets.YISHAN_DEPLOY_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          printf '%s\n' "${{ secrets.YISHAN_DEPLOY_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519 ~/.ssh/known_hosts
          SSH="ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes ${{ secrets.YISHAN_DEPLOY_USER }}@${{ secrets.YISHAN_DEPLOY_HOST }}"
          echo "SSH=$SSH" >> "$GITHUB_ENV"

      - name: Package artifact
        run: node scripts/package-api.mjs --output .build/function-code --admin apps/demo/admin/dist

      - name: Upload and release
        run: |
          set -euo pipefail
          TS="$(date -u +%Y%m%d-%H%M%S)"
          $SSH "mkdir -p /opt/yishan/releases/$TS"
          rsync -az --delete -e "ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes" \
            .build/function-code/ \
            ${{ secrets.YISHAN_DEPLOY_USER }}@${{ secrets.YISHAN_DEPLOY_HOST }}:/opt/yishan/releases/$TS/
          $SSH "cd /opt/yishan/releases/$TS && /usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node dist/scripts/migrate.js --dry-run"
          $SSH "bash /opt/yishan/bin/release.sh $TS"
```

- [ ] **Step 6: 写冒烟检查段**

沿用现有逻辑，改为对 admin 域名执行：轮询最多 10 次 `${{ vars.SMOKE_BASE_URL }}/api/health`，断言 `success == true && data.status == "ok" && data.db.ok == true`；再断言 `${SMOKE_BASE_URL}/admin/` 返回 200。

- [ ] **Step 7: 验证 guardrail 通过**

```bash
node scripts/check-deploy-workflows.mjs
```

Expected: 无输出（通过）。**若报 `missing-workflow`，说明 Step 3 的 `paths:` 清理没做。若报 `no-ci-gate`，说明 `needs: ci-gate` 被误删。若报 `no-manual-trigger`，说明缺 `workflow_dispatch`。**

- [ ] **Step 8: 验证 workflow YAML 语法**

```bash
node -e "require('fs').readFileSync('.github/workflows/yishan-api-cd.yml','utf8')" && npx --yes js-yaml .github/workflows/yishan-api-cd.yml > /dev/null && echo "YAML OK"
```

Expected: `YAML OK`。

- [ ] **Step 9: 确认无 FC 残留**

```bash
grep -nE "s deploy|aliyun|AssumeRole|FC_DEPLOY_ROLE_ARN|serverless-devs" .github/workflows/yishan-api-cd.yml || echo "无 FC 残留"
```

Expected: `无 FC 残留`。

- [ ] **Step 10: 提交**

```bash
git add .github/workflows/yishan-api-cd.yml
git commit -m "ci(deploy): publish demo API to Tencent server via rsync + systemd

Replaces the FC OIDC + 's deploy' path. Migrations now run on the server
from the packaged artifact (dist/scripts/migrate.js needs no devDeps), which
also removes the SSH tunnel to the Aliyun ECS."
```

---

### Task 10: 重写 yishan-h5-cd.yml 并移除 FC 专用 workflow

**Files:**
- Modify: `.github/workflows/yishan-h5-cd.yml`
- Delete: `.github/workflows/yishan-cert-rotate-fc.yml`
- Delete: `.github/workflows/yishan-h5-cert-rotate.yml`

**Interfaces:**
- Consumes: Task 8 Step 7 的 H5 部署路径
- Produces: 自动发布 H5 的 workflow。

- [ ] **Step 1: 重写 h5 workflow 的 deploy job**

保留 `ci-gate` job 与触发路径（`apps/demo/app/**`、`packages/core/app/**`、`packages/ui/**`、`apps/demo/config/**`、lockfile 等）。deploy job 改为：

```bash
          (cd apps/demo/app && NODE_ENV=production pnpm run build:h5)
          TS="$(date -u +%Y%m%d-%H%M%S)"
          $SSH "mkdir -p /opt/yishan/h5/$TS"
          rsync -az --delete -e "ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes" \
            apps/demo/app/dist/h5/ \
            ${{ secrets.YISHAN_DEPLOY_USER }}@${{ secrets.YISHAN_DEPLOY_HOST }}:/opt/yishan/h5/$TS/
          $SSH "sudo ln -sfn /opt/yishan/h5/$TS /opt/yishan/h5-current && sudo systemctl reload nginx"
```

**删除** `deploy-domain` job（整个 acme.sh + FC domain 模板流程，证书已由服务器侧 acme.sh 接管）与 `npm i -g @serverless-devs/s` / OIDC 段。

- [ ] **Step 2: 删除两个 cert-rotate workflow**

```bash
git rm .github/workflows/yishan-cert-rotate-fc.yml .github/workflows/yishan-h5-cert-rotate.yml
```

**删除前确认**：这两个文件在 `SCHEDULE_ONLY` 白名单里（`scripts/check-deploy-workflows.mjs:28`）。删除后**必须同步从该白名单中移除这两个文件名**，否则白名单里残留不存在的文件不会报错，但 `SCHEDULE_ONLY` 判断会失准。

- [ ] **Step 3: 清理 guardrail 白名单**

编辑 `scripts/check-deploy-workflows.mjs:28`：

```js
const SCHEDULE_ONLY = new Set(['yishan-h5-cert-rotate.yml', 'yishan-cert-rotate-fc.yml'])
```
改为：
```js
const SCHEDULE_ONLY = new Set()
```

若保留空的 `Set` 无意义，可直接删除该常量并把第 102 行处的引用改为 `false`。**保持二者一致。**

- [ ] **Step 4: 检查其他 workflow 是否引用被删文件**

```bash
grep -rn "cert-rotate" .github/workflows/ scripts/check-deploy-workflows.mjs
```

Expected: 仅剩 Step 3 处理后的一致状态。**若 `yishan-h5-cd.yml` 或 `yishan-api-cd.yml` 的 `paths:` 中引用了被删文件，必须一并移除，否则 CI 报 `missing-workflow`。**

- [ ] **Step 5: 验证 guardrail 通过**

```bash
node scripts/check-deploy-workflows.mjs
```

Expected: 无输出。

- [ ] **Step 6: 提交**

```bash
git add .github/workflows/yishan-h5-cd.yml scripts/check-deploy-workflows.mjs
git commit -m "ci(deploy): publish H5 via rsync; drop FC cert-rotation workflows

TLS is now managed by acme.sh on the Tencent host with Le_ReloadCmd set,
so the scheduled FC certificate workflows are redundant."
```

---

### Task 11: 部署文档与工程文档更新

**Files:**
- Create: `apps/demo/api/deploy/server/README.md`
- Modify: `apps/portal/docs/content/deploy/prod.md`
- Modify: `apps/demo/api/deploy/fc3/docs/environment-variables.md`
- Modify: `docs/engineering/release.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1-10 的最终形态
- Produces: 无代码接口。

- [ ] **Step 1: 写 `apps/demo/api/deploy/server/README.md`**

内容须覆盖：目录布局（`releases/`、`shared/`、`h5/`、`incoming/`、`current` 软链接）、`release.sh` 用法与退出码语义、首次发布手工步骤、**必须设置的三个易错环境变量**（`TRUST_PROXY_IPS=127.0.0.1`、`DATABASE_URL` 主机必须是 `139.196.89.64`、`PUBLIC_PATH` 必须为 `/admin/`）、回滚步骤（切软链接 + `systemctl restart yishan-api`）、日志位置（`journalctl -u yishan-api`）。

- [ ] **Step 2: 更新 `apps/portal/docs/content/deploy/prod.md`**

替换 FC 语义（`custom.debian12`、`s deploy`、`PORT` 3000 vs 3100 的 FC 约定）为服务器语义。保留"迁移需 `--dry-run` 后 `--apply`"的约束。

- [ ] **Step 3: 重写 `apps/demo/api/deploy/fc3/docs/environment-variables.md` 的 `TRUST_PROXY_IPS` 一节**

现有内容记录了 FC 实测值 `21.0.0.1`。补充说明：该值仅适用于 FC；服务器部署为 `127.0.0.1`（nginx 同机反代），沿用 FC 值会导致审计与限流记录到错误 IP。

- [ ] **Step 4: 更新 `docs/engineering/release.md` 与根 `CLAUDE.md`**

`CLAUDE.md` 的 **Deploy** 一段现描述 FC 与已移除的七牛上传，需更新为：demo 走腾讯云单机，FC 仅保留给未迁移的其他函数（`daifuyang-com`、`genlabs`、`content-flow` 等 10 个），七牛已移除的事实保持不变。

- [ ] **Step 5: 提交**

```bash
git add apps/demo/api/deploy/server/README.md apps/portal/docs/content/deploy/prod.md \
  apps/demo/api/deploy/fc3/docs/environment-variables.md docs/engineering/release.md CLAUDE.md
git commit -m "docs: describe server deployment and retire FC instructions for demo"
```

---

### Task 12: 清理已入库的敏感文件与构建产物（独立，需单独确认）

**Files:**
- Modify: `.gitignore`
- Delete: `apps/demo/app/deploy/fc3/certs/`、`apps/demo/api/deploy/fc3/.build/`

**Interfaces:**
- Consumes: 无
- Produces: 无

> ⚠️ **本任务会删除已被 Git 跟踪的文件，且 `private.key` 需要轮换才能真正安全。**
> 建议**单独提交并单独评审**，不要与部署改动混在一起。

- [ ] **Step 1: 确认这两个路径当前确实被 Git 跟踪**

```bash
git ls-files apps/demo/app/deploy/fc3/certs/ apps/demo/api/deploy/fc3/.build/ | head -20
```

Expected: 输出文件列表。

- [ ] **Step 2: 在 `.gitignore` 中加入这两条**

```
apps/demo/app/deploy/fc3/certs/
apps/demo/api/deploy/fc3/.build/
```

- [ ] **Step 3: 从索引移除（保留工作区文件）**

```bash
git rm -r --cached apps/demo/app/deploy/fc3/certs/ apps/demo/api/deploy/fc3/.build/
```

- [ ] **Step 4: 提交**

```bash
git add .gitignore
git commit -m "chore: stop tracking H5 private key and FC build output

The certs/private.key in deploy/fc3 was committed to the repository. It
must be rotated on the server; removing it from history is a separate
concern and is not done here."
```

- [ ] **Step 5: 记录仍需人工完成的事**

在 PR 描述中记录：`private.key` 仍存在于 Git 历史中，需要 (a) 轮换 `h5.zerocmf.com` 证书，(b) 决定是否用 `git filter-repo` 清理历史。**本任务只阻止继续跟踪，不声称已消除泄漏。**
